#!/usr/bin/env node
/**
 * Trial Expiry Notify - Daily cron (9 AM)
 * Finds trials ending in 24h and sends reminder email with portal link
 * Run: 0 9 * * *
 */

import pg from 'pg';
import { Resend } from 'resend';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const resend = new Resend(process.env.RESEND_API_KEY);

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

async function main() {
  const client = await pool.connect();
  try {
    // Find users with trials ending in 24 hours
    const users = await client.query(`
      SELECT id, email, name, stripe_customer_id, stripe_subscription_id, stripe_trial_end
      FROM users
      WHERE subscription_status = 'trialing'
        AND stripe_trial_end BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
        AND trial_expiry_notified = FALSE
    `);

    if (users.rows.length === 0) {
      console.log('No trials expiring in 24h');
      return;
    }

    for (const user of users.rows) {
      // Create Stripe portal session for easy payment update
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });

      let portalUrl = 'https://letsmakeai.fun/settings';
      try {
        const session = await stripe.billingPortal.sessions.create({
          customer: user.stripe_customer_id,
          return_url: 'https://letsmakeai.fun/settings',
        });
        portalUrl = session.url;
      } catch (err) {
        console.error(`Portal session failed for ${user.email}:`, err.message);
      }

      const trialEndDate = new Date(user.stripe_trial_end).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric'
      });

      const html = `
        <p>Hi ${user.name || 'there'},</p>
        <p>Your HomeworkHelper free trial ends <strong>${trialEndDate}</strong>.</p>
        <p>To keep unlimited AI grading (all subjects, all standards, handwriting OCR), just add a payment method.</p>
        <p><a href="${portalUrl}" style="display:inline-block;padding:12px 24px;background:#f59e0b;color:white;text-decoration:none;border-radius:6px;">Update Payment & Keep Access</a></p>
        <p>If you don't act, your account will pause at trial end. No charges until you confirm.</p>
        <p>Questions? Reply to this email — I read every one.</p>
        <p>— Skyler<br>HomeworkHelper</p>
      `;

      try {
        await resend.emails.send({
          from: 'Skyler @ HomeworkHelper <skyler@letsmakeai.fun>',
          to: user.email,
          subject: `Your trial ends ${trialEndDate} — keep grading on autopilot`,
          html,
        });

        await client.query(`
          UPDATE users SET trial_expiry_notified = TRUE WHERE id = $1
        `, [user.id]);

        console.log(`Trial expiry notice sent to ${user.email}`);
      } catch (err) {
        console.error(`Failed to send to ${user.email}:`, err.message);
      }
    }

    // Send summary Discord alert
    await sendDiscordAlert(
      'Trial Expiry Notifications Sent',
      `Notified ${users.rows.length} user(s) with trials ending in 24h`,
      'info',
      users.rows.map(u => ({ name: u.email, value: `Trial ends: ${new Date(u.stripe_trial_end).toLocaleDateString()}`, inline: true }))
    );
  } catch (err) {
    console.error('Trial expiry notify failed:', err);
    await sendDiscordAlert('Trial Expiry Notify Failed', err.message, 'critical');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();