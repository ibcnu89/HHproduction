#!/usr/bin/env node
/**
 * Bulk Initialize Sequences
 * Creates outreach sequences for ALL prospects with verified emails
 * that don't already have an active sequence.
 *
 * Env: DATABASE_URL
 */

import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DEFAULT_SEQUENCE = [
  { step: 0, type: 'call', day: 0 },
  { step: 1, type: 'email', day: 2 },
  { step: 2, type: 'call', day: 5 },
  { step: 3, type: 'linkedin', day: 10 },
  { step: 4, type: 'email', day: 14 },
  { step: 5, type: 'email', day: 21 },
];

async function createSequenceForProspect(client, prospectId) {
  // Check if already has active sequence
  const existing = await client.query(
    'SELECT id FROM outreach_sequences WHERE prospect_id = $1 AND status = \'active\'',
    [prospectId]
  );
  if (existing.rows.length > 0) {
    return { skipped: true, sequenceId: existing.rows[0].id };
  }

  // Create sequence
  const seqResult = await client.query(`
    INSERT INTO outreach_sequences (prospect_id, name, current_step, status, next_due_at)
    VALUES ($1, 'default_6_touch', 0, 'active', NOW())
    RETURNING id
  `, [prospectId]);

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

  return { skipped: false, sequenceId };
}

async function main() {
  console.log('=== Bulk Initialize Sequences for ALL Verified Prospects ===\n');

  const client = await pool.connect();
  try {
    // Get ALL prospects with verified emails that DON'T have active sequences
    const prospects = await client.query(`
      SELECT id, email, first_name, last_name, school, subject, state
      FROM outreach_prospects
      WHERE email IS NOT NULL 
        AND email != ''
        AND email_verified IN ('verified', 'accept_all')
        AND id NOT IN (SELECT prospect_id FROM outreach_sequences WHERE status = 'active')
      ORDER BY 
        CASE 
          WHEN email_verified = 'verified' THEN 1
          WHEN email_verified = 'accept_all' THEN 2
          ELSE 3
        END,
        RANDOM()
    `);

    console.log(`Found ${prospects.rows.length} verified prospects without active sequences`);

    if (prospects.rows.length === 0) {
      console.log('No new prospects to initialize. All verified prospects already have sequences.');
      return;
    }

    let created = 0, skipped = 0;
    for (const p of prospects.rows) {
      const result = await createSequenceForProspect(client, p.id);
      if (result.skipped) {
        skipped++;
        console.log(`  SKIPPED (already has sequence): ${p.school} (${p.email})`);
      } else {
        created++;
        console.log(`  CREATED: ${p.school} (${p.email}) [${p.subject}] -> ${result.sequenceId}`);
      }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Created: ${created}`);
    console.log(`Skipped (already had): ${skipped}`);
    console.log(`Total processed: ${prospects.rows.length}`);

    // Show all active sequences
    const all = await client.query(`
      SELECT s.id, s.prospect_id, s.current_step, s.next_due_at, p.school, p.email, p.state
      FROM outreach_sequences s
      JOIN outreach_prospects p ON s.prospect_id = p.id
      WHERE s.status = 'active'
      ORDER BY s.next_due_at
    `);

    console.log(`\n=== ALL Active Sequences (${all.rows.length}) ===`);
    for (const s of all.rows) {
      console.log(`  ${s.school} (${s.email}) [${s.state}] - Step ${s.current_step}, Due: ${s.next_due_at}`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});