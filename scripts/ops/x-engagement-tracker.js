#!/usr/bin/env node
/**
 * X Engagement Tracker — Phase 8
 *
 * Runs daily. For posts published in the last 7 days, fetches
 * like/retweet/reply counts via xurl CLI and stores in
 * scheduled_content.meta.performance_metrics.
 *
 * Skipped (logs "skipped") if X credentials not available.
 */

import pg from 'pg';
import { execFileSync } from 'child_process';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function xCredentialsAvailable() {
  try {
    const out = execFileSync('xurl', ['whoami'], { encoding: 'utf-8', timeout: 10000 });
    return !out.includes('Unauthorized') && !out.includes('401');
  } catch {
    return false;
  }
}

function getMetricsFor(postId) {
  try {
    const out = execFileSync('xurl', ['read', postId], { encoding: 'utf-8', timeout: 15000 });
    const likesMatch = out.match(/"like_count":\s*(\d+)/);
    const retweetsMatch = out.match(/"retweet_count":\s*(\d+)/);
    const repliesMatch = out.match(/"reply_count":\s*(\d+)/);
    const quotesMatch = out.match(/"quote_count":\s*(\d+)/);
    return {
      likes: likesMatch ? parseInt(likesMatch[1]) : null,
      retweets: retweetsMatch ? parseInt(retweetsMatch[1]) : null,
      replies: repliesMatch ? parseInt(repliesMatch[1]) : null,
      quotes: quotesMatch ? parseInt(quotesMatch[1]) : null,
      fetched_at: new Date().toISOString(),
    };
  } catch (e) {
    return { error: e.message.substring(0, 200) };
  }
}

async function main() {
  console.log('=== X Engagement Tracker ===');
  console.log(`Time: ${new Date().toISOString()}`);

  if (!xCredentialsAvailable()) {
    console.log('X credentials missing — skipping.');
    await pool.end();
    return;
  }

  const { rows } = await pool.query(`
    SELECT id, title, meta->>'published_id' as published_id
    FROM scheduled_content
    WHERE content_type IN ('twitter_post', 'twitter_thread')
      AND status = 'published'
      AND meta->>'published_id' IS NOT NULL
      AND published_at > NOW() - INTERVAL '7 days'
  `);

  console.log(`Recent posts to refresh: ${rows.length}`);

  let updated = 0;
  for (const post of rows) {
    if (!post.published_id) continue;
    const metrics = getMetricsFor(post.published_id);
    if (metrics.error) {
      console.error(`  ❌ ${post.published_id}: ${metrics.error}`);
      continue;
    }
    await pool.query(`
      UPDATE scheduled_content
      SET meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{performance_metrics}', $2::jsonb)
      WHERE id = $1
    `, [post.id, JSON.stringify(metrics)]);
    updated++;
    console.log(`  ✅ ${post.published_id}: ${metrics.likes || 0} likes, ${metrics.retweets || 0} RTs, ${metrics.replies || 0} replies`);
  }

  console.log(`\nUpdated: ${updated}/${rows.length}`);
  await pool.end();
}

main().catch(async e => {
  console.error('Engagement tracker failed:', e);
  await pool.end().catch(() => {});
  process.exit(1);
});
