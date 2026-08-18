#!/usr/bin/env node
/**
 * Channel Dashboard — all-time signup attribution summary
 * Run: node scripts/ops/lifecycle/channel-dashboard.js
 *
 * Shows: total signups, by channel, by campaign, and trial->paid conversion per channel.
 * Run anytime to see which marketing efforts actually produce paying users.
 */
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    // 1. Total signups by channel (all time)
    const ch = await client.query(`
      SELECT COALESCE(NULLIF(utm_source,''),'direct') AS channel, COUNT(*) AS signups
      FROM users
      GROUP BY 1 ORDER BY 2 DESC
    `);
    console.log('\n=== ALL-TIME SIGNUPS BY CHANNEL ===');
    if (ch.rows.length) {
      for (const r of ch.rows) console.log(`  ${r.channel.padEnd(12)} ${r.signups}`);
    } else console.log('  (no users)');

    // 2. Signups by campaign (with source context)
    const camp = await client.query(`
      SELECT
        COALESCE(NULLIF(utm_source,''),'direct') AS channel,
        COALESCE(NULLIF(utm_campaign,''),'(none)')   AS campaign,
        COUNT(*) AS signups
      FROM users
      WHERE utm_campaign IS NOT NULL
      GROUP BY 1,2 ORDER BY 3 DESC
    `);
    console.log('\n=== CAMPAIGN BREAKDOWN ===');
    if (camp.rows.length) {
      for (const r of camp.rows) console.log(`  ${r.channel.padEnd(12)} | ${r.campaign.padEnd(24)} ${r.signups}`);
    } else console.log('  (no campaigns tracked yet)');

    // 3. Conversion rate by channel (of trials that have closed)
    const conv = await client.query(`
      SELECT
        COALESCE(NULLIF(utm_source,''),'direct') AS channel,
        COUNT(*) FILTER (WHERE stripe_trial_end IS NOT NULL) AS trials_started,
        COUNT(*) FILTER (WHERE subscription_status='active') AS converted,
        ROUND(100.0 * COUNT(*) FILTER (WHERE subscription_status='active') /
              NULLIF(COUNT(*) FILTER (WHERE stripe_trial_end IS NOT NULL), 0), 1) AS rate_pct
      FROM users
      WHERE stripe_trial_end IS NOT NULL
      GROUP BY 1 ORDER BY 4 DESC NULLS LAST
    `);
    console.log('\n=== TRIAL -> PAID BY CHANNEL ===');
    if (conv.rows.length) {
      console.log('  channel      | trials | paid | rate%');
      for (const r of conv.rows) {
        const rate = r.rate_pct ? `${r.rate_pct}%` : 'n/a';
        console.log(`  ${(r.channel).padEnd(12)} | ${String(r.trials_started).padStart(6)} | ${String(r.converted).padStart(4)} | ${rate.padStart(5)}`);
      }
    } else console.log('  (no trials yet)');

    // 4. Recent signups (last 14 days) with attribution
    const recent = await client.query(`
      SELECT
        to_char(created_at, 'YYYY-MM-DD HH24:MI') AS when,
        email,
        COALESCE(NULLIF(utm_source,''),'direct') AS channel,
        COALESCE(utm_campaign,'') AS campaign,
        CASE WHEN subscription_status='active' THEN 'PAID' ELSE subscription_status END AS status
      FROM users
      WHERE created_at >= NOW() - INTERVAL '14 days'
      ORDER BY created_at DESC
      LIMIT 30
    `);
    console.log('\n=== RECENT SIGNUPS (last 14 days) ===');
    if (recent.rows.length) {
      console.log('  when                 | email                    | channel  | campaign             | status');
      for (const r of recent.rows) {
        const camp = r.campaign ? r.campaign.substring(0, 20).padEnd(20) : ''.padEnd(20);
        console.log(`  ${r.when} | ${r.email.substring(0, 24).padEnd(24)} | ${r.channel.padEnd(8)} | ${camp} | ${r.status}`);
      }
    } else console.log('  (no recent signups)');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('[channel-dashboard] failed:', err);
  process.exit(1);
});