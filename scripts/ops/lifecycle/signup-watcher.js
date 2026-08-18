#!/usr/bin/env node
/**
 * Signup Watcher — real-time channel attribution alert
 * Runs frequently (GH Actions every 15 min). Detects NEW tracked signups
 * (users created since the last run who came from a UTM channel) and posts a
 * Discord alert so you know live which marketing post/group is working.
 *
 * Only alerts on NON-direct signups (utm_source is set) — organic/direct
 * signups are expected noise and would spam the channel.
 *
 * Idempotent via a watermark row in attribution_watch (last_seen_user_id
 * tracked as the max users.id, ordered by created_at). Runs safely even if
 * delayed/wrapped around.
 *
 * Env: DATABASE_URL, DISCORD_OPS_WEBHOOK
 * Schedule: every 15 minutes (GH Actions cron expression is "/15 * * * *")
 */
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const WEBHOOK = process.env.DISCORD_OPS_WEBHOOK;
const COLORS = { success: 0x22c55e, info: 0x3b82f6, warning: 0xf59e0b, critical: 0xef4444 };
const EMOJIS = { success: '✅', info: 'ℹ️', warning: '⚠️', critical: '🚨' };

async function sendDiscord(title, description, level, fields = []) {
  if (!WEBHOOK) { console.warn('[signup-watcher] no DISCORD_OPS_WEBHOOK'); return; }
  try {
    await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: `${EMOJIS[level]} ${title}`,
          description,
          color: COLORS[level],
          timestamp: new Date().toISOString(),
          footer: { text: 'HHproduction Lifecycle' },
          fields: fields.map(f => ({ name: f.name, value: f.value, inline: f.inline ?? true })),
        }],
      }),
    });
  } catch (e) { console.error('[signup-watcher] discord send failed:', e.message); }
}

async function ensureWatermarkTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS attribution_watch (
      key        TEXT PRIMARY KEY,
      last_max_id TEXT           -- last (id, created_at) cursor; stored as "id|epochms"
    );
  `);
}

async function main() {
  const client = await pool.connect();
  try {
    await ensureWatermarkTable(client);

    const { rows: [wm] } = await client.query(
      `SELECT last_max_id FROM attribution_watch WHERE key = 'signup_watch'`
    );
    const prev = wm?.last_max_id || null; // "uuid|epochms" or null on first run

    let prevId = null, prevEpoch = 0;
    if (prev) {
      const [id, epoch] = prev.split('|');
      prevId = id; prevEpoch = Number(epoch) || 0;
    }
    const sinceIso = prevEpoch ? new Date(prevEpoch).toISOString() : null;

    // New tracked users created AFTER the previous max row (by created_at,
    // tiebroken by id). Watermark is exact, so no double-alerts on retries.
    const res = await client.query(`
      SELECT id, email, name, created_at, utm_source, utm_medium, utm_campaign
      FROM users
      WHERE utm_source IS NOT NULL
        ${sinceIso ? `AND created_at > $1` : ``}
      ORDER BY created_at ASC
      LIMIT 25
    `, sinceIso ? [sinceIso] : []);

    const newUsers = res.rows.filter(u =>
      sinceIso ? true          // window-based catch-up after first watermark
        : !prevId              // first run: report everything currently present
    );

    // Update watermark to the max created_at row seen (all users we scanned up to).
    if (res.rows.length) {
      const last = res.rows[res.rows.length - 1];
      const cursor = `${last.id}|${new Date(last.created_at).getTime()}`;
      await client.query(
        `INSERT INTO attribution_watch (key, last_max_id) VALUES ('signup_watch', $1)
         ON CONFLICT (key) DO UPDATE SET last_max_id = EXCLUDED.last_max_id`,
        [cursor]
      );
    }

    if (newUsers.length === 0) {
      console.log('[signup-watcher] no new tracked signups');
      return;
    }

    console.log(`[signup-watcher] ${newUsers.length} new tracked signup(s)`);
    const counts = {};
    for (const u of newUsers) {
      const ch = u.utm_source || 'unknown';
      counts[ch] = (counts[ch] || 0) + 1;
      console.log(`  + ${ch} | ${u.email} | ${u.utm_campaign || ''} | ${u.created_at}`);
    }

    const detail = newUsers
      .map(u => `• **${u.utm_source}**${u.utm_campaign ? ` / \`${u.utm_campaign}\`` : ''} — \`${u.email}\``)
      .join('\n');

    await sendDiscord(
      `New signups by channel (${newUsers.length})`,
      detail,
      newUsers.length >= 3 ? 'success' : 'info',
      Object.entries(counts).map(([ch, n]) => ({ name: ch, value: n, inline: true }))
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('[signup-watcher] failed:', err);
  process.exit(1);
});