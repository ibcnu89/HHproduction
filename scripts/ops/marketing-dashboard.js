#!/usr/bin/env node
/**
 * Marketing Status Dashboard — Phase 11
 *
 * Read-only check that reports current state of:
 *  - Email outreach pipeline
 *  - X/Twitter content queue
 *  - Blog topics + briefs + drafts
 *  - Cron job health
 *
 * Posts to Discord as a formatted summary.
 */

import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DISCORD_WEBHOOK = process.env.DISCORD_OPS_WEBHOOK;

async function discordPost(title, fields) {
  if (!DISCORD_WEBHOOK) {
    console.log(`[would post to Discord]: ${title}`);
    console.log(JSON.stringify(fields, null, 2));
    return;
  }
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title,
          color: 0x3b82f6,
          timestamp: new Date().toISOString(),
          footer: { text: 'HH Marketing Dashboard' },
          fields: fields.map(f => ({ name: f.name, value: f.value, inline: f.inline ?? false })),
        }],
      }),
    });
  } catch (e) {
    console.error('Discord post failed:', e.message);
  }
}

async function getEmailStats() {
  const stats = {};

  const status = await pool.query(`SELECT status, count(*)::int as n FROM outreach_prospects GROUP BY status ORDER BY status`);
  stats.status_breakdown = status.rows;

  const queue = await pool.query(`
    SELECT count(*)::int as n FROM outreach_prospects
    WHERE email IS NOT NULL AND email LIKE '%@%'
      AND status NOT IN ('unsubscribed','bounced','replied','interested','contacted')
      AND (last_contacted IS NULL OR last_contacted < NOW() - INTERVAL '30 days')
  `);
  stats.eligible_queue = queue.rows[0].n;

  const recent = await pool.query(`SELECT count(*)::int as n FROM outreach_prospects WHERE last_contacted > NOW() - INTERVAL '24 hours'`);
  stats.sent_last_24h = recent.rows[0].n;

  try {
    const replies = await pool.query(`SELECT count(*)::int as n FROM outreach_replies WHERE created_at > NOW() - INTERVAL '7 days'`);
    stats.replies_last_7d = replies.rows[0].n;
  } catch {
    stats.replies_last_7d = 'table_missing';
  }

  return stats;
}

async function getXStats() {
  const stats = {};

  const byStatus = await pool.query(`
    SELECT status, count(*)::int as n FROM scheduled_content
    WHERE content_type IN ('twitter_post','twitter_thread')
    GROUP BY status ORDER BY status
  `);
  stats.by_status = byStatus.rows;

  const due = await pool.query(`
    SELECT count(*)::int as n FROM scheduled_content
    WHERE content_type IN ('twitter_post','twitter_thread')
      AND status = 'approved'
      AND (meta->>'approval_status') = 'human_approved'
      AND publish_at <= NOW()
  `);
  stats.due_approved = due.rows[0].n;

  const upcoming = await pool.query(`
    SELECT count(*)::int as n FROM scheduled_content
    WHERE content_type IN ('twitter_post','twitter_thread')
      AND status IN ('draft','approved')
      AND publish_at > NOW()
      AND publish_at < NOW() + INTERVAL '7 days'
  `);
  stats.upcoming_7d = upcoming.rows[0].n;

  return stats;
}

async function getBlogStats() {
  const byStatus = await pool.query(`
    SELECT status, count(*)::int as n FROM blog_topics GROUP BY status ORDER BY status
  `);
  return { by_status: byStatus.rows };
}

async function main() {
  console.log('=== Marketing Status Dashboard ===\n');

  const [email, x, blog] = await Promise.all([
    getEmailStats(),
    getXStats(),
    getBlogStats(),
  ]);

  const lines = [];
  lines.push(`EMAIL: queue=${email.eligible_queue} sent_24h=${email.sent_last_24h} replies_7d=${email.replies_last_7d}`);
  lines.push(`  status: ${email.status_breakdown.map(s => `${s.status}=${s.n}`).join(', ')}`);

  lines.push(`\nX: due_approved=${x.due_approved} upcoming_7d=${x.upcoming_7d}`);
  lines.push(`  status: ${x.by_status.map(s => `${s.status}=${s.n}`).join(', ')}`);

  lines.push(`\nBLOG: ${blog.by_status.map(s => `${s.status}=${s.n}`).join(', ')}`);

  const summary = lines.join('\n');
  console.log(summary);

  const fields = [
    {
      name: '📧 Email outreach',
      value: `Queue: **${email.eligible_queue}**\nSent 24h: **${email.sent_last_24h}**\nReplies 7d: **${email.replies_last_7d}**\nStatus: ${email.status_breakdown.map(s => `${s.status}=${s.n}`).join(', ')}`,
    },
    {
      name: '🐦 X/Twitter',
      value: `Due approved: **${x.due_approved}**\nUpcoming 7d: **${x.upcoming_7d}**\nStatus: ${x.by_status.map(s => `${s.status}=${s.n}`).join(', ')}`,
    },
    {
      name: '📝 Blog',
      value: blog.by_status.map(s => `${s.status}=${s.n}`).join(', ') || 'no topics',
    },
  ];

  await discordPost('HH Marketing Dashboard — Daily Snapshot', fields);

  await pool.end();
}

main().catch(async e => {
  console.error('Dashboard failed:', e);
  await pool.end().catch(() => {});
  process.exit(1);
});
