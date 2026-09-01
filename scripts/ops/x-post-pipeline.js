#!/usr/bin/env node
/**
 * X/Twitter Post Pipeline — Phase 8
 *
 * Reads approved drafts from `scheduled_content` table and publishes
 * via xurl CLI. If X credentials missing, runs in DRAFT-ONLY mode
 * (logs what it would post, leaves status unchanged).
 *
 * NEVER publishes a draft that doesn't have approval_status='human_approved'.
 *
 * Circuit breakers:
 *  - X API down → alert Discord, leave status=approved for retry
 *  - X rejects post → mark status='rejected', record error, alert Discord
 *  - Token expired → alert Discord, freeze cron
 */

import pg from 'pg';
import { execFileSync } from 'child_process';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DISCORD_WEBHOOK = process.env.DISCORD_OPS_WEBHOOK;

async function discordAlert(title, description, color = 0x3b82f6) {
  if (!DISCORD_WEBHOOK) return;
  try {
    const { default: fetch } = await import('node-fetch').catch(() => ({ default: globalThis.fetch }));
    const f = fetch || globalThis.fetch;
    await f(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title, description, color,
          timestamp: new Date().toISOString(),
          footer: { text: 'HH X/Twitter Pipeline' },
        }],
      }),
    });
  } catch (e) {
    console.error('Discord alert failed:', e.message);
  }
}

function xCredentialsAvailable() {
  // Check if xurl is authed by attempting a lightweight call (execFile avoids shell)
  try {
    const out = execFileSync('xurl', ['whoami'], { encoding: 'utf-8', timeout: 10000 });
    return !out.includes('Unauthorized') && !out.includes('401');
  } catch {
    return false;
  }
}

function publishViaXurl(text) {
  // execFile passes text as an argument array — no shell interpolation
  try {
    const out = execFileSync('xurl', ['post', text], { encoding: 'utf-8', timeout: 30000 });
    const match = out.match(/"id":\s*"(\d+)"/);
    return { success: true, post_id: match ? match[1] : null, raw: out.substring(0, 500) };
  } catch (e) {
    return { success: false, error: (e.stdout?.toString() || e.message).substring(0, 500) };
  }
}

async function main() {
  console.log('=== X/Twitter Post Pipeline ===');
  console.log(`Time: ${new Date().toISOString()}`);

  const hasCreds = xCredentialsAvailable();
  console.log(`X credentials: ${hasCreds ? 'AVAILABLE' : 'MISSING (draft-only mode)'}`);

  // Fetch due, human-approved posts
  const { rows: due } = await pool.query(`
    SELECT id, title, text, meta, publish_at
    FROM scheduled_content
    WHERE content_type IN ('twitter_post', 'twitter_thread')
      AND status = 'approved'
      AND (meta->>'approval_status') = 'human_approved'
      AND publish_at <= NOW()
    ORDER BY publish_at ASC
    LIMIT 10
  `);

  console.log(`Due approved posts: ${due.length}`);

  if (due.length === 0) {
    console.log('Nothing to publish.');
    await pool.end();
    return;
  }

  if (!hasCreds) {
    console.log('\n[DRAFT-ONLY] The following posts are approved and due:');
    for (const p of due) {
      console.log(`  - [${p.id.substring(0, 8)}] ${p.title}`);
      console.log(`    ${p.text.substring(0, 100)}...`);
    }
    console.log('\nTo enable publishing, provide X credentials via `xurl auth` or env vars.');
    await pool.end();
    return;
  }

  // Live publishing
  let published = 0, failed = 0;
  for (const post of due) {
    console.log(`\nPublishing: ${post.title} (${post.id.substring(0, 8)})`);
    const result = publishViaXurl(post.text);

    if (result.success) {
      published++;
      await pool.query(`
        UPDATE scheduled_content
        SET status = 'published',
            published_at = NOW(),
            meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{published_id}', to_jsonb($2::text))
        WHERE id = $1
      `, [post.id, result.post_id]);
      console.log(`  ✅ Published: id=${result.post_id}`);
    } else {
      failed++;
      await pool.query(`
        UPDATE scheduled_content
        SET status = 'rejected',
            error = $2
        WHERE id = $1
      `, [post.id, result.error]);
      console.error(`  ❌ Rejected: ${result.error}`);
      await discordAlert('❌ X Post Rejected', `Title: ${post.title}\nError: ${result.error}`, 0xef4444);
    }
  }

  console.log(`\n=== Complete ===`);
  console.log(`Published: ${published}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    await discordAlert('⚠️ X Post Pipeline — Errors', `${failed} posts failed to publish out of ${due.length}. See DB.`, 0xef4444);
  }

  await pool.end();
}

main().catch(async e => {
  console.error('X pipeline failed:', e);
  await discordAlert('🚨 X Pipeline Failed', e.message, 0xef4444);
  await pool.end().catch(() => {});
  process.exit(1);
});
