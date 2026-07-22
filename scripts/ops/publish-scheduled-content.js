#!/usr/bin/env node
/**
 * Publish Scheduled Content - Weekly cron (Monday 9 AM)
 * Reads scheduled content from DB and posts to social platforms
 * Run: 0 9 * * 1
 */

import pg from 'pg';

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

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Platform posting functions (implement with actual APIs)
async function postToTwitter(content) {
  console.log('[Twitter] Would post:', content.text.substring(0, 100));
}

async function postToLinkedIn(content) {
  console.log('[LinkedIn] Would post:', content.text.substring(0, 100));
}

async function postToReddit(content) {
  console.log('[Reddit] Would post to r/', content.subreddit);
}

async function publishBlogPost(content) {
  console.log('[Blog] Would publish:', content.title);
}

async function sendNewsletter(content) {
  console.log('[Newsletter] Would send:', content.subject);
}

async function sendEmailViaResend(item) {
  // TODO: Implement actual Resend send
  console.log('[Email] Would send:', item.meta?.subject || item.title, 'to subscribers');
}

async function main() {
  const client = await pool.connect();
  try {
    // Get scheduled content due for publishing
    const content = await client.query(`
      SELECT * FROM scheduled_content
      WHERE status = 'scheduled'
        AND publish_at <= NOW()
      ORDER BY publish_at
    `);

    if (content.rows.length === 0) {
      console.log('No content scheduled for publishing');
      await sendDiscordAlert('Content Publish Check', 'No content scheduled for publishing', 'info');
      return;
    }

    let published = 0;
    let failed = 0;

    for (const item of content.rows) {
      try {
        const platforms = Array.isArray(item.platforms) ? item.platforms : JSON.parse(item.platforms || '[]');
        
        // Handle email content type
        if (item.content_type === 'email') {
          await sendEmailViaResend(item);
        }
        
        if (platforms.includes('twitter')) await postToTwitter(item);
        if (platforms.includes('linkedin')) await postToLinkedIn(item);
        if (platforms.includes('reddit')) await postToReddit(item);
        if (platforms.includes('blog')) await publishBlogPost(item);
        if (platforms.includes('newsletter')) await sendNewsletter(item);

        await client.query(`
          UPDATE scheduled_content SET status = 'published', published_at = NOW()
          WHERE id = $1
        `, [item.id]);

        console.log(`Published: ${item.title} (${item.content_type})`);
        published++;
      } catch (err) {
        console.error(`Failed to publish ${item.id}:`, err.message);
        await client.query(`
          UPDATE scheduled_content SET status = 'failed', error = $1 WHERE id = $2
        `, [err.message, item.id]);
        failed++;
      }
    }

    // Send summary Discord alert
    await sendDiscordAlert(
      'Content Publish Complete',
      `Published ${published} items, ${failed} failed`,
      failed > 0 ? 'warning' : 'success',
      [
        { name: 'Published', value: published.toString(), inline: true },
        { name: 'Failed', value: failed.toString(), inline: true },
      ]
    );
  } catch (err) {
    console.error('Content publish failed:', err);
    await sendDiscordAlert('Content Publish Failed', err.message, 'critical');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();