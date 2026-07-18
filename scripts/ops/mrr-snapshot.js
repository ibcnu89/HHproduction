#!/usr/bin/env node
/**
 * MRR Snapshot - Daily cron job (midnight)
 * Captures daily MRR, trial counts, churn events for dashboard
 * Run: 0 0 * * *
 */

import pg from 'pg';
import Stripe from 'stripe';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });

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
    // Get data from Stripe
    const subscriptions = await stripe.subscriptions.list({
      status: 'all',
      limit: 100,
      expand: ['data.customer', 'data.items.data.price']
    });

    // Calculate metrics
    let mrr = 0;
    let activeSubs = 0;
    let trialingSubs = 0;
    let pastDueSubs = 0;
    let canceledSubs = 0;
    let newThisMonth = 0;
    let churnedThisMonth = 0;

    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);

    for (const sub of subscriptions.data) {
      const price = sub.items.data[0]?.price;
      const monthlyAmount = price?.recurring?.interval === 'month' 
        ? price.unit_amount / 100 
        : (price?.unit_amount || 0) / 100 / 12; // rough annual to monthly

      switch (sub.status) {
        case 'active':
          mrr += monthlyAmount;
          activeSubs++;
          break;
        case 'trialing':
          trialingSubs++;
          break;
        case 'past_due':
          pastDueSubs++;
          break;
        case 'canceled':
          canceledSubs++;
          if (sub.canceled_at && sub.canceled_at > thirtyDaysAgo) {
            churnedThisMonth++;
            mrr -= monthlyAmount;
          }
          break;
      }

      if (sub.created > thirtyDaysAgo) {
        newThisMonth++;
      }
    }

    // Get trial conversion data
    const trialResult = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE subscription_status = 'trialing') as active_trials,
        COUNT(*) FILTER (WHERE subscription_status = 'active' AND trial_converted_at > NOW() - INTERVAL '30 days') as trial_conversions_30d
      FROM users
    `);

    // Insert snapshot
    await client.query(`
      INSERT INTO mrr_snapshots (
        date, mrr_usd, active_subscriptions, trialing_subscriptions, 
        past_due_subscriptions, canceled_subscriptions, 
        new_subscriptions_30d, churned_subscriptions_30d,
        active_trials, trial_conversions_30d,
        raw_stripe_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (date) DO UPDATE SET
        mrr_usd = EXCLUDED.mrr_usd,
        active_subscriptions = EXCLUDED.active_subscriptions,
        trialing_subscriptions = EXCLUDED.trialing_subscriptions,
        past_due_subscriptions = EXCLUDED.past_due_subscriptions,
        canceled_subscriptions = EXCLUDED.canceled_subscriptions,
        new_subscriptions_30d = EXCLUDED.new_subscriptions_30d,
        churned_subscriptions_30d = EXCLUDED.churned_subscriptions_30d,
        active_trials = EXCLUDED.active_trials,
        trial_conversions_30d = EXCLUDED.trial_conversions_30d,
        raw_stripe_data = EXCLUDED.raw_stripe_data,
        updated_at = NOW()
    `, [
      new Date().toISOString().split('T')[0],
      mrr.toFixed(2),
      activeSubs,
      trialingSubs,
      pastDueSubs,
      canceledSubs,
      newThisMonth,
      churnedThisMonth,
      trialResult.rows[0]?.active_trials || 0,
      trialResult.rows[0]?.trial_conversions_30d || 0,
      JSON.stringify({ subscriptions: subscriptions.data.map(s => ({ id: s.id, status: s.status, amount: s.items.data[0]?.price?.unit_amount })) })
    ]);

    console.log(`MRR Snapshot: $${mrr.toFixed(2)} | Active: ${activeSubs} | Trialing: ${trialingSubs} | New: ${newThisMonth} | Churned: ${churnedThisMonth}`);

    // Send Discord alert
    const level = churnedThisMonth > 2 ? 'warning' : mrr > 0 ? 'success' : 'info';
    await sendDiscordAlert(
      'Daily MRR Snapshot',
      `$${mrr.toFixed(2)} MRR | ${activeSubs} active | ${trialingSubs} trialing | ${newThisMonth} new | ${churnedThisMonth} churned`,
      level,
      [
        { name: 'Active Subs', value: activeSubs.toString(), inline: true },
        { name: 'Trialing', value: trialingSubs.toString(), inline: true },
        { name: 'Past Due', value: pastDueSubs.toString(), inline: true },
        { name: 'New (30d)', value: newThisMonth.toString(), inline: true },
        { name: 'Churned (30d)', value: churnedThisMonth.toString(), inline: true },
      ]
    );
  } catch (err) {
    console.error('MRR snapshot failed:', err);
    await sendDiscordAlert('MRR Snapshot Failed', err.message, 'critical');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();