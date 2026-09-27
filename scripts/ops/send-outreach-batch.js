#!/usr/bin/env node
/**
 * Send Outreach Batch - Daily cron (Mon-Fri 10 AM)
 * Sends personalized cold emails to teacher prospects
 * Run: 0 10 * * 1-5
 */

import pg from 'pg';
import { Resend } from 'resend';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const resend = new Resend(process.env.RESEND_API_KEY);

// Discord alert utility
const WEBHOOK_URL = process.env.DISCORD_OPS_WEBHOOK;
const COLORS = { info: 0x3b82f6, success: 0x22c55e, warning: 0xf59e0b, critical: 0xef4444 };
const EMOJIS = { info: 'ℹ️', success: '✅', warning: '⚠️', critical: '🚨' };

async function sendDiscordAlert(title, description, level = 'info', fields = []) {
  if (!WEBHOOK_URL) return;
  const embed = {
    title: `${EMOJIS[level]} ${title}`,
    description,
    color: COLORS[level],
    timestamp: new Date().toISOString(),
    footer: { text: 'HHproduction Ops' },
    fields: fields.map(f => ({ name: f.name, value: f.value, inline: f.inline ?? true })),
  };
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (err) {
    console.error('[Discord Alert] Failed:', err.message);
  }
}

const OUTREACH_TEMPLATES = [
  {
    subject: "Quick question about your grading workload",
    html: `
      <p>Hi {{first_name}},</p>
      <p>I noticed you teach {{subject}} at {{school}} — respect. That's a lot of papers.</p>
      <p>I built an AI tool that grades handwritten homework against state standards in seconds. Teachers using it cut grading time by ~80%.</p>
      <p>Free 7-day trial, no commitment. Want me to send a 60-second demo video?</p>
      <p>— Skyler<br>HomeworkHelper<br><a href="{{unsubscribe_url}}">Unsubscribe</a></p>
    `,
    text: `Hi {{first_name}},\n\nI noticed you teach {{subject}} at {{school}} — respect. That's a lot of papers.\n\nI built an AI tool that grades handwritten homework against state standards in seconds. Teachers using it cut grading time by ~80%.\n\nFree 7-day trial, no commitment. Want me to send a 60-second demo video?\n\n— Skyler\nHomeworkHelper\n{{unsubscribe_url}}`
  },
  {
    subject: "Your Tuesday night grading pile",
    html: `
      <p>Hi {{first_name}},</p>
      <p>Tuesday night. Stack of {{subject}} papers. Netflix waiting.</p>
      <p>What if you could snap a photo of each paper and get standards-aligned grades + feedback in 30 seconds?</p>
      <p>That's what HomeworkHelper does. Illinois Learning Standards, custom rubrics, handwriting OCR.</p>
      <p>7-day free trial. Cancel anytime. <a href="https://letsmakeai.fun">Try it here</a>.</p>
      <p>— Skyler<br><a href="{{unsubscribe_url}}">Unsubscribe</a></p>
    `,
    text: `Hi {{first_name}},\n\nTuesday night. Stack of {{subject}} papers. Netflix waiting.\n\nWhat if you could snap a photo of each paper and get standards-aligned grades + feedback in 30 seconds?\n\nThat's what HomeworkHelper does. Illinois Learning Standards, custom rubrics, handwriting OCR.\n\n7-day free trial. Cancel anytime. https://letsmakeai.fun\n\n— Skyler\n{{unsubscribe_url}}`
  }
];

async function main() {
  const client = await pool.connect();
  try {
    // Get prospects who haven't been contacted in 30 days AND have email
    const emailProspects = await client.query(`
      SELECT * FROM outreach_prospects
      WHERE status = 'new'
        AND email IS NOT NULL
        AND (last_contacted IS NULL OR last_contacted < NOW() - INTERVAL '30 days')
      ORDER BY RANDOM()
      LIMIT 5
    `);

    // Get prospects with phones but no emails for call follow-up
    const callProspects = await client.query(`
      SELECT * FROM outreach_prospects
      WHERE status = 'new'
        AND email IS NULL
        AND phone IS NOT NULL
        AND (last_contacted IS NULL OR last_contacted < NOW() - INTERVAL '30 days')
      ORDER BY RANDOM()
      LIMIT 10
    `);

    if (emailProspects.rows.length === 0 && callProspects.rows.length === 0) {
      console.log('No prospects to contact');
      await sendDiscordAlert('Outreach Batch Complete', 'No prospects to contact today', 'info');
      return;
    }

    let sent = 0;
    let failed = 0;
    let callQueued = 0;

    // Send emails for prospects with emails - WITH PERSONALIZATION & UNSUBSCRIBE
    if (emailProspects.rows.length > 0) {
      for (const prospect of emailProspects.rows) {
        // Pick random template per prospect
        const template = OUTREACH_TEMPLATES[Math.floor(Math.random() * OUTREACH_TEMPLATES.length)];
        
        const unsubscribeUrl = `https://letsmakeai.fun/unsubscribe?email=${encodeURIComponent(prospect.email)}`;
        
        const personalizedHtml = template.html
          .replace(/{{first_name}}/g, prospect.first_name || prospect.contact_first_name || 'there')
          .replace(/{{subject}}/g, prospect.subject || 'your class')
          .replace(/{{school}}/g, prospect.school || 'your school')
          .replace(/{{unsubscribe_url}}/g, unsubscribeUrl);

        const personalizedText = template.text
          .replace(/{{first_name}}/g, prospect.first_name || prospect.contact_first_name || 'there')
          .replace(/{{subject}}/g, prospect.subject || 'your class')
          .replace(/{{school}}/g, prospect.school || 'your school')
          .replace(/{{unsubscribe_url}}/g, unsubscribeUrl);

        try {
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'Skyler @ HomeworkHelper <skyler@letsmakeai.fun>',
            to: prospect.email,
            subject: template.subject,
            html: personalizedHtml,
            text: personalizedText,
            headers: {
              'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:unsubscribe@letsmakeai.fun?subject=unsubscribe>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          });

          await client.query(`
            UPDATE outreach_prospects
            SET status = 'contacted', last_contacted = NOW(), touch_count = touch_count + 1
            WHERE id = $1
          `, [prospect.id]);

          console.log(`Sent email to ${prospect.email} (${prospect.school}): ${template.subject}`);
          sent++;
        } catch (err) {
          console.error(`Failed to send to ${prospect.email}:`, err.message);
          failed++;
        }

        // Rate limit: 30 seconds between sends
        await new Promise(r => setTimeout(r, 30000));
      }
    }

    // Generate call scripts for phone prospects
    if (callProspects.rows.length > 0) {
      console.log(`\nGenerating call scripts for ${callProspects.rows.length} prospects...`);
      
      for (const prospect of callProspects.rows) {
        try {
          // Generate call script using Ollama
          const callScriptPrompt = `Write a SHORT CALL SCRIPT for calling a teacher/principal.

RULES:
- You are Skyler, founder of HomeworkHelper (AI grading for handwritten homework)
- Your wife is a teacher who graded 120 essays every Sunday for 8 years
- Introduce yourself and HomeworkHelper
- Ask if grading piles are stealing their nights/weekends
- Ask if they're open to a quick demo (no scheduling pressure)
- No pricing, no pressure
- Under 130 words
- Tone: friendly and local
- End with a simple question

School:
Name: ${prospect.school}
Role/Subject: ${prospect.subject}
Location: ${prospect.city}
Phone: ${prospect.phone}`;

          const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'qwen2.5:7b-instruct',
              prompt: callScriptPrompt,
              stream: false,
              options: { temperature: 0.4, top_p: 0.9 },
            }),
          });

          const data = await response.json();
          const callScript = data.response?.trim() || 'Script generation failed';

          // Save call script to file
          const fs = await import('fs');
          const path = await import('path');
          const callDir = '/home/ibcnu/marketing_agents/call_scripts';
          await fs.promises.mkdir(callDir, { recursive: true });
          
          const safeName = prospect.school.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const scriptPath = path.join(callDir, `${timestamp}_${safeName}_call.txt`);
          
          const scriptContent = `CHANNEL: CALL SCRIPT
PHONE: ${prospect.phone}
SCHOOL: ${prospect.school}
LOCATION: ${prospect.city}

${callScript}
`;
          
          await fs.promises.writeFile(scriptPath, scriptContent);
          console.log(`  Call script saved: ${scriptPath}`);

          // Update prospect status to call_queued
          await client.query(`
            UPDATE outreach_prospects
            SET status = 'call_queued', last_contacted = NOW(), touch_count = touch_count + 1
            WHERE id = $1
          `, [prospect.id]);

          callQueued++;
        } catch (err) {
          console.error(`Failed to generate call script for ${prospect.school}:`, err.message);
        }
      }
    }

    // Send summary Discord alert
    await sendDiscordAlert(
      'Outreach Batch Complete',
      `Sent ${sent} emails, ${failed} failed. ${callQueued} call scripts generated.`,
      failed > 0 ? 'warning' : 'success',
      [
        { name: 'Emails Sent', value: sent.toString(), inline: true },
        { name: 'Email Failed', value: failed.toString(), inline: true },
        { name: 'Call Scripts', value: callQueued.toString(), inline: true },
      ]
    );
  } catch (err) {
    console.error('Outreach batch failed:', err);
    await sendDiscordAlert('Outreach Batch Failed', err.message, 'critical');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();