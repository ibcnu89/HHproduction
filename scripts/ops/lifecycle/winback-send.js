#!/usr/bin/env node
/**
 * Win-Back Send (daily cron)
 * After a user's trial expires, sends:
 *   winback_day1  — discount offer (Day 1 after expiry)
 *   winback_day3  — final nudge      (Day 3 after expiry)
 *
 * Relies on trial_expired_at being stamped on the users row when the trial
 * lapses. (A companion script can backfill trial_expired_at from
 * stripe_subscription_status/canceled transitions; for now we derive expiry
 * from stripe_trial_end when the trial window has closed and the user is no
 * longer trialing.)
 *
 * Sends are idempotent via user_drip_emails (UNIQUE user+type).
 *
 * Schedule: 0 9 * * *  (daily 9 AM UTC)
 */
import { getPool, getResend, sendAndLog, sendDiscordAlert, wrapH1, APP_URL } from './_lib.js';

const pool = getPool();
const resend = getResend();
const DISCORD = process.env.DISCORD_OPS_WEBHOOK;

// Discount for the win-back Day 1 offer. TODO(user): confirm amount.
const DISCOUNT_LABEL = '30% off';
const DISCOUNT_CODE = 'WELCOMEBACK30';

const CTA = (label, href) =>
  `<p><a href="${href}" style="display:inline-block;padding:12px 24px;background:#f59e0b;color:white;text-decoration:none;border-radius:6px;font-weight:bold">${label}</a></p>`;

function renderWinback1(name) {
  const n = name || 'there';
  return wrapH1(
    `<p>Hi ${n},</p>
     <p>Your HomeworkHelper trial just ended — but your grading pile didn't. 😉</p>
     <p>To get you back without hesitation, here's <b>${DISCOUNT_LABEL}</b> off your first month. Use code <b>${DISCOUNT_CODE}</b> at checkout.</p>
     ${CTA(`Claim ${DISCOUNT_LABEL} now`, `${APP_URL}/settings`)}
     <p>This stands for the next few days. After that, standard pricing applies.</p>
     <p>— Skyler</p>`
  );
}

function renderWinback3(name) {
  const n = name || 'there';
  return wrapH1(
    `<p>Hi ${n},</p>
     <p>Last call — the <b>${DISCOUNT_LABEL}</b> offer expires today.</p>
     <p>If grading is ever going to keep stealing your nights and weekends, HomeworkHelper is the fix. One photo → standards-aligned grade + feedback.</p>
     ${CTA(`Use ${DISCOUNT_CODE} before it's gone`, `${APP_URL}/settings`)}
     <p>No pressure either way — but I'd rather you keep access than lose you to the weekend pile.</p>
     <p>— Skyler</p>`
  );
}

async function main() {
  const client = await pool.connect();
  try {
    // Users whose trial has ended (stripe_trial_end in the past, no longer trialing),
    // who are not currently paying, and haven't been sent the win-back yet.
    const res = await client.query(`
      SELECT id, email, name, stripe_trial_end, trial_expired_at
      FROM users
      WHERE subscription_status IN ('no_subscription','canceled','past_due','unpaid')
        AND stripe_trial_end IS NOT NULL
        AND stripe_trial_end <= NOW()
        AND (trial_expired_at IS NULL OR trial_expired_at > NOW() - INTERVAL '3 days')
        AND winback_day1_sent = FALSE
    `);

    console.log(`[winback-send] ${res.rows.length} expired-trial user(s) found`);

    let sentDay1 = 0, sentDay3 = 0, failed = 0;

    for (const u of res.rows) {
      const daysAfter = Math.floor((Date.now() - new Date(u.stripe_trial_end).getTime()) / 86400000);

      // Stamp trial_expired_at once (first time we see them post-expiry) so the
      // "day after expiry" anchor is stable even if cron scheduling lags.
      if (!u.trial_expired_at) {
        await client.query(`UPDATE users SET trial_expired_at = stripe_trial_end WHERE id = $1`, [u.id]);
        u.trial_expired_at = u.stripe_trial_end;
      }

      // Day 1 win-back
      if (daysAfter >= 1 && daysAfter < 2 && !u.winback_day1_sent) {
        const out = await sendAndLog(pool, resend, {
          userId: u.id, email: u.email, emailType: 'winback_day1', variant: 'standard',
          subject: `Grading pile back? Here's ${DISCOUNT_LABEL}`,
          html: renderWinback1(u.name),
        });
        if (out.sent) {
          await client.query(`UPDATE users SET winback_day1_sent = TRUE WHERE id = $1`, [u.id]);
          sentDay1++;
        } else if (!out.skip) failed++;
      }
      // Day 3 win-back
      else if (daysAfter >= 3 && daysAfter < 4 && u.winback_day1_sent && !u.winback_day3_sent) {
        const out = await sendAndLog(pool, resend, {
          userId: u.id, email: u.email, emailType: 'winback_day3', variant: 'standard',
          subject: `Last call: ${DISCOUNT_LABEL} off ends today`,
          html: renderWinback3(u.name),
        });
        if (out.sent) {
          await client.query(`UPDATE users SET winback_day3_sent = TRUE WHERE id = $1`, [u.id]);
          sentDay3++;
        } else if (!out.skip) failed++;
      }

      await new Promise(r => setTimeout(r, 900));
    }

    console.log(`[winback-send] day1=${sentDay1} day3=${sentDay3} failed=${failed}`);
    if (sentDay1 || sentDay3 || failed) {
      await sendDiscordAlert(
        DISCORD, 'Win-Back Sent',
        `Day-1 discount: ${sentDay1} | Day-3 nudge: ${sentDay3} | failed: ${failed}`,
        failed ? 'warning' : 'success',
        [
          { name: 'Day 1', value: sentDay1, inline: true },
          { name: 'Day 3', value: sentDay3, inline: true },
          { name: 'Failed', value: failed, inline: true },
        ]
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('[winback-send] failed:', err);
  process.exit(1);
});