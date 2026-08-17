#!/usr/bin/env node
/**
 * Welcome Drip — Enroll (daily cron)
 * Scans users who are on a free trial and haven't been enrolled in the
 * welcome drip yet, and marks them as started.
 *
 * Enrollment itself is lightweight: it just stamps welcome_drip_started.
 * The actual Day-1/3/5/7 sends are done by welcome-drip-send.js.
 *
 * Schedule: 0 8 * * *  (daily 8 AM UTC, before the 9 AM send runs)
 */
import { getPool, sendDiscordAlert } from './_lib.js';

const pool = getPool();
const DISCORD = process.env.DISCORD_OPS_WEBHOOK;

async function main() {
  const client = await pool.connect();
  try {
    // New trial users: subscription_status is GENERATED => 'trialing'
    // when stripe_subscription_status='trialing'. Enroll those who haven't started.
    const res = await client.query(`
      UPDATE users
      SET welcome_drip_started = COALESCE(welcome_drip_started, NOW()),
          trial_expired_at    = NULL
      WHERE subscription_status = 'trialing'
        AND welcome_drip_started IS NULL
      RETURNING id, email
    `);

    console.log(`[welcome-drip-enroll] Enrolled ${res.rowCount} new trial user(s)`);

    if (res.rowCount > 0) {
      await sendDiscordAlert(
        DISCORD, 'Welcome Drip: New Enrollments',
        `${res.rowCount} new trial user(s) entered the 7-day drip.`,
        'info',
        res.rows.slice(0, 10).map(u => ({ name: u.email, value: 'enrolled', inline: true }))
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('[welcome-drip-enroll] failed:', err);
  process.exit(1);
});