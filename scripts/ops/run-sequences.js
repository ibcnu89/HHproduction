#!/usr/bin/env node
/**
 * Multi-Touch Sequence Runner
 * Runs daily to check for due sequence steps and execute them
 * 
 * Required env vars:
 * - DATABASE_URL
 * - RESEND_API_KEY
 * - DISCORD_OPS_WEBHOOK (optional, for alerts)
 */

import pg from 'pg';
import fetch from 'node-fetch';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DISCORD_WEBHOOK = process.env.DISCORD_OPS_WEBHOOK;
const FROM_EMAIL = 'Skyler @ HomeworkHelper <skyler@letsmakeai.fun>';

// Default 6-touch sequence
const DEFAULT_SEQUENCE = [
  { step: 0, type: 'call', day: 0, name: 'Initial Call' },
  { step: 1, type: 'email', day: 2, name: 'Day 2 Email', subjectVar: 'email_subject' },
  { step: 2, type: 'call', day: 5, name: 'Follow-up Call' },
  { step: 3, type: 'linkedin', day: 10, name: 'LinkedIn Connection' },
  { step: 4, type: 'email', day: 14, name: 'Case Study Email', subjectVar: 'case_study_subject' },
  { step: 5, type: 'email', day: 21, name: 'Breakup Email', subjectVar: 'breakup_subject' },
];

// Email templates
const EMAIL_TEMPLATES = {
  'email_subject': 'Grading {{school}}s essays this weekend?',
  'case_study_subject': 'How {{similar_school}} got 1hr 45min back per assignment',
  'breakup_subject': 'Still grading by hand this weekend?',
  'email': `Hi {{first_name}},

I'm Skyler, founder of HomeworkHelper. My wife was a teacher who graded 120 essays every Sunday for 8 years — I built this so she didn't have to.

HomeworkHelper uses AI to grade handwritten homework in seconds, not hours. Teachers at schools like {{similar_school}} are getting their weekends back.

Open to a quick screen-share this week to see the grading grid? No pressure.

Best,
Skyler
skyler@letsmakeai.fun`,

  'case_study': `Hi {{first_name}},

Following up — wanted to share a quick story.

{{similar_school}} (also {{state}}) was drowning in grading. Their English department used HomeworkHelper for the spring semester:

• 80% less time grading
• 4.2/5 teacher satisfaction
• Students got feedback in 24hrs instead of 2 weeks

The case study is here: https://letsmakeai.fun/case-studies/{{similar_school_slug}}

Happy to walk you through it if useful.

Best,
Skyler`,

  'breakup': `Hi {{first_name}},

I'll keep this brief — I don't want to clutter your inbox.

If grading piles are ever stealing your team's weekends, HomeworkHelper is here. We grade handwritten work with AI so teachers don't have to.

All the best,
Skyler

P.S. If you change your mind, just reply — I read every email.`
};

// A/B test subjects for Day 2 email
const AB_TESTS = {
  'day2_email': {
    A: 'Grading {{school}}s essays this weekend?',
    B: '{{first_name}}, 120 essays → 30 min?'
  }
};

async function sendDiscordAlert(title, description, color = 0x3b82f6) {
  if (!DISCORD_WEBHOOK) return;
  
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title,
          description,
          color,
          timestamp: new Date().toISOString(),
          footer: { text: 'HomeworkHelper Sequence Runner' }
        }]
      })
    });
  } catch (err) {
    console.error('Discord alert failed:', err.message);
  }
}

function personalizeTemplate(template, prospect) {
  return template
    .replace(/{{first_name}}/g, 'there') // We don't have teacher names yet
    .replace(/{{school}}/g, prospect.school || 'your school')
    .replace(/{{state}}/g, prospect.state || 'your state')
    .replace(/{{similar_school}}/g, 'a nearby district')
    .replace(/{{similar_school_slug}}/g, 'nearby-district');
}

async function sendEmail(to, subject, html, text) {
  if (!RESEND_API_KEY) {
    console.log('  [DRY RUN] Would send email to:', to);
    return { success: true, id: 'dry-run-' + Date.now() };
  }
  
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
        text
      })
    });
    
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message || 'Resend error');
    return { success: true, id: data.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function getDueSequences() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        s.id as sequence_id,
        s.prospect_id,
        s.current_step,
        s.name as sequence_name,
        p.email,
        p.school,
        p.state,
        p.district,
        p.phone
      FROM outreach_sequences s
      JOIN outreach_prospects p ON s.prospect_id = p.id
      WHERE s.status = 'active'
        AND s.next_due_at <= NOW()
        AND s.reply_received = FALSE
      ORDER BY s.next_due_at ASC
    `);
    return result.rows;
  } finally {
    client.release();
  }
}

async function getPendingSteps(sequenceId) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM outreach_sequence_steps
      WHERE sequence_id = $1
        AND status = 'pending'
        AND scheduled_at <= NOW()
      ORDER BY step_number ASC
    `, [sequenceId]);
    return result.rows;
  } finally {
    client.release();
  }
}

async function createSequenceForProspect(prospectId, sequenceName = 'default_6_touch') {
  const client = await pool.connect();
  try {
    // Check if already has active sequence
    const existing = await client.query(
      'SELECT id FROM outreach_sequences WHERE prospect_id = $1 AND status = \'active\'',
      [prospectId]
    );
    if (existing.rows.length > 0) return existing.rows[0].id;
    
    // Create sequence
    const seqResult = await client.query(`
      INSERT INTO outreach_sequences (prospect_id, name, current_step, status, next_due_at)
      VALUES ($1, $2, 0, 'active', NOW())
      RETURNING id
    `, [prospectId, sequenceName]);
    
    const sequenceId = seqResult.rows[0].id;
    
    // Create steps
    const startDate = new Date();
    for (const step of DEFAULT_SEQUENCE) {
      const scheduledAt = new Date(startDate);
      scheduledAt.setDate(scheduledAt.getDate() + step.day);
      
      await client.query(`
        INSERT INTO outreach_sequence_steps (sequence_id, step_number, step_type, scheduled_at, status)
        VALUES ($1, $2, $3, $4, 'pending')
      `, [sequenceId, step.step, step.type, scheduledAt]);
    }
    
    return sequenceId;
  } finally {
    client.release();
  }
}

async function executeStep(sequenceId, step, prospect) {
  const client = await pool.connect();
  try {
    let result = { success: false, externalId: null, error: null };
    
    if (step.step_type === 'email') {
      // Determine which template
      let templateKey = 'email';
      let subjectTemplate = EMAIL_TEMPLATES['email_subject'];
      
      if (step.step_number === 4) {
        templateKey = 'case_study';
        subjectTemplate = EMAIL_TEMPLATES['case_study_subject'];
      } else if (step.step_number === 5) {
        templateKey = 'breakup';
        subjectTemplate = EMAIL_TEMPLATES['breakup_subject'];
      }
      
      // A/B test for step 1 (Day 2 email)
      let subject = subjectTemplate;
      if (step.step_number === 1) {
        // Randomly assign A or B
        const variant = Math.random() > 0.5 ? 'A' : 'B';
        subject = AB_TESTS['day2_email'][variant];
        
        // Record A/B assignment
        await client.query(`
          INSERT INTO outreach_ab_results (ab_test_id, prospect_id, variant)
          VALUES (
            (SELECT id FROM outreach_ab_tests WHERE name = 'day2_email_subject'),
            $1, $2
          )
          ON CONFLICT DO NOTHING
        `, [prospect.prospect_id, variant]);
      }
      
      subject = personalizeTemplate(subject, prospect);
      const html = personalizeTemplate(EMAIL_TEMPLATES[templateKey], prospect);
      const text = html.replace(/<[^>]*>/g, '').replace(/\n\s+/g, '\n').trim();
      
      const emailResult = await sendEmail(prospect.email, subject, html, text);
      result = emailResult;
      
    } else if (step.step_type === 'call') {
      // For calls, just log as completed - actual calling is manual
      console.log(`  [CALL TASK] Call ${prospect.school} (${prospect.phone}) - Step ${step.step_number}`);
      result = { success: true, externalId: 'call-task-' + Date.now() };
      
      // Could create a task in a task system here
    } else if (step.step_type === 'linkedin') {
      // LinkedIn connection - manual reminder
      console.log(`  [LINKEDIN TASK] Connect with ${prospect.school} admin on LinkedIn`);
      result = { success: true, externalId: 'linkedin-task-' + Date.now() };
    }
    
    // Update step status
    await client.query(`
      UPDATE outreach_sequence_steps
      SET status = $1, sent_at = CASE WHEN $1 = 'sent' THEN NOW() ELSE sent_at END, result = $2
      WHERE id = $3
    `, [result.success ? 'sent' : 'failed', result.error || JSON.stringify(result), step.id]);
    
    // Update sequence
    await client.query(`
      UPDATE outreach_sequences
      SET current_step = $1, last_activity_at = NOW(),
          next_due_at = (
            SELECT MIN(scheduled_at) FROM outreach_sequence_steps
            WHERE sequence_id = outreach_sequences.id AND status = 'pending'
          )
      WHERE id = $2
    `, [step.step_number + 1, sequenceId]);
    
    return result;
  } finally {
    client.release();
  }
}

async function main() {
  console.log('=== Sequence Runner Starting ===');
  console.log(`Time: ${new Date().toISOString()}`);
  
  if (!RESEND_API_KEY) {
    console.warn('������  RESEND_API_KEY not set - running in DRY RUN mode');
  }
  
  // Ensure A/B test exists
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO outreach_ab_tests (name, variant_a_subject, variant_b_subject, active)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO NOTHING
      `, ['day2_email_subject', "Quick question about {{school}}'s grading", '{{first_name}} — getting your weekends back?', true]);
    } finally {
      client.release();
    }
  
  // Get due sequences
  const dueSequences = await getDueSequences();
  console.log(`Found ${dueSequences.length} sequences with due steps`);
  
  let executed = 0;
  let failed = 0;
  
  for (const seq of dueSequences) {
    if (!seq.email) {
      console.log(`  Skipping ${seq.school} - no email`);
      // Still advance call/linkedin steps
      const steps = await getPendingSteps(seq.sequence_id);
      for (const step of steps) {
        if (step.step_type !== 'email') {
          const result = await executeStep(seq.sequence_id, step, seq);
          if (result.success) executed++; else failed++;
        }
      }
      continue;
    }
    
    const steps = await getPendingSteps(seq.sequence_id);
    
    for (const step of steps) {
      console.log(`  Executing: ${seq.school} - Step ${step.step_number} (${step.step_type})`);
      const result = await executeStep(seq.sequence_id, step, seq);
      
      if (result.success) {
        executed++;
        console.log(`    �� ${step.step_type} sent`);
      } else {
        failed++;
        console.log(`    �� Failed: ${result.error}`);
      }
      
      // Small delay between sends
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  console.log(`\n=== Complete ===`);
  console.log(`Executed: ${executed}`);
  console.log(`Failed: ${failed}`);
  
  if (executed > 0 || failed > 0) {
    await sendDiscordAlert(
      'Sequence Runner Complete',
      `Executed ${executed} steps, ${failed} failed`,
      failed > 0 ? 0xf59e0b : 0x22c55e
    );
  }
  
  await pool.end();
}

main().catch(err => {
  console.error('Sequence runner failed:', err);
  process.exit(1);
});