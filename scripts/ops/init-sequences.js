#!/usr/bin/env node
/**
 * Initialize sequences for test prospects
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

async function createSequenceForProspect(prospectId) {
  const client = await pool.connect();
  try {
    // Check if already has active sequence
    const existing = await client.query(
      'SELECT id FROM outreach_sequences WHERE prospect_id = $1 AND status = \'active\'',
      [prospectId]
    );
    if (existing.rows.length > 0) {
      console.log(`  Already has sequence: ${existing.rows[0].id}`);
      return existing.rows[0].id;
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
    
    console.log(`  Created sequence ${sequenceId} for prospect ${prospectId}`);
    return sequenceId;
  } finally {
    client.release();
  }
}

async function main() {
  console.log('=== Initializing Sequences for Top Prospects ===');
  
  // Get top prospects (with emails or top districts)
  const client = await pool.connect();
  try {
    // First, get prospects with emails
    const withEmail = await client.query(`
      SELECT id, school, email FROM outreach_prospects 
      WHERE email IS NOT NULL AND email != ''
      LIMIT 10
    `);
    
    console.log(`Found ${withEmail.rows.length} prospects with emails`);
    for (const p of withEmail.rows) {
      await createSequenceForProspect(p.id);
    }
    
    // Also get top prospects from largest districts
    const topProspects = await client.query(`
      SELECT id, school FROM outreach_prospects 
      WHERE id NOT IN (SELECT prospect_id FROM outreach_sequences WHERE status = 'active')
      ORDER BY 
        CASE 
          WHEN nces_district_id IN (
            SELECT nces_district_id FROM outreach_prospects 
            WHERE nces_district_id IS NOT NULL
            GROUP BY nces_district_id 
            ORDER BY count(*) DESC LIMIT 20
          ) THEN 1 ELSE 2 END,
        RANDOM()
      LIMIT 20
    `);
    
    console.log(`Found ${topProspects.rows.length} additional top prospects`);
    for (const p of topProspects.rows) {
      await createSequenceForProspect(p.id);
    }
    
    // Show all active sequences
    const all = await client.query(`
      SELECT s.id, s.prospect_id, s.current_step, s.next_due_at, p.school, p.email
      FROM outreach_sequences s
      JOIN outreach_prospects p ON s.prospect_id = p.id
      WHERE s.status = 'active'
      ORDER BY s.next_due_at
    `);
    
    console.log(`\n=== Active Sequences (${all.rows.length}) ===`);
    for (const s of all.rows) {
      console.log(`  ${s.school} (${s.email || 'no email'}) - Step ${s.current_step}, Due: ${s.next_due_at}`);
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