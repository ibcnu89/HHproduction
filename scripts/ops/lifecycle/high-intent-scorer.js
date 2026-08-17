#!/usr/bin/env node
/**
 * High-Intent Scorer
 * Runs frequently (suggest every 2 hours).
 * Tags a trialing user as high_intent if they solved >5 homework questions
 * within 48 hours of signup, and shortens their drip from 7 to 5 days.
 *
 * "Questions solved" = # of questions in the batch session `results` JSONB
 * that carry is_correct = true, in sessions created within 48h of signup.
 *
 * Drip shortening: high_intent users only receive Day 1/3/5 (5 days total).
 * Day 5 becomes the expiring-trial warning (handled by welcome-drip-send.js
 * via the high_intent branch); the social-proof email is skipped.
 */
import { getPool, sendDiscordAlert } from './_lib.js';

const pool = getPool();
const DISCORD = process.env.DISCORD_OPS_WEBHOOK;

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT u.id, u.email, u.name, sc.n AS solved_in_48h
      FROM users u
      JOIN LATERAL (
        SELECT COUNT(*) AS n
        FROM batch_grading_sessions s,
             jsonb_array_elements(COALESCE(s.results, '[]'::jsonb)) q
        WHERE s.user_id = u.id
          AND s.created_at BETWEEN u.created_at
                               AND u.created_at + INTERVAL '48 hours'
          AND (q->>'is_correct')::boolean = TRUE
      ) sc ON sc.n > 5
      WHERE u.subscription_status = 'trialing'
        AND u.high_intent = FALSE
    `);

    let tagged = 0;
    for (const u of res.rows) {
      await client.query(`
        UPDATE users
        SET high_intent_at = COALESCE(high_intent_at, NOW()),
            high_intent    = TRUE,
            drip_shortened = TRUE
        WHERE id = $1
      `, [u.id]);
      tagged++;
      console.log(`  [high-intent] tagged ${u.email} (${u.solved_in_48h} solved in 48h) -> drip shortened to 5 days`);
    }

    console.log(`[high-intent-scorer] tagged ${tagged} user(s)`);
    if (tagged) {
      await sendDiscordAlert(
        DISCORD, 'High-Intent Users Tagged',
        `${tagged} trial user(s) solved >5 questions in 48h and moved to the 5-day drip.`,
        'info',
        res.rows.map(u => ({ name: u.email, value: 'high-intent', inline: true }))
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('[high-intent-scorer] failed:', err);
  process.exit(1);
});