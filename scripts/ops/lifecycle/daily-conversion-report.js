#!/usr/bin/env node
/**
 * Daily Conversion Report (daily cron, morning)
 * Emails the admin (you) the previous day's trial -> paid conversion rate.
 *
 * Definition (Day D):
 *   Denominator = users who STARTED a trial that lapsed/closed on day D.
 *   Numerator   = of those, who ended up with subscription_status='active'
 *                 (converted to a paid plan) by now.
 *
 * Because trials are 7 days, "started_trial_date + 7" lands on the day the
 * decision window closes; we bucket by that closure date = trial_end date
 * and report the day BEFORE the run date (previous full day).
 *
 * Schedule: 0 12 * * *  (12:00 UTC -> covers previous UTC day)
 */
import { getPool, getResend, sendDiscordAlert, wrapH1, ADMIN_EMAIL } from './_lib.js';

const pool = getPool();
const resend = getResend();
const DISCORD = process.env.DISCORD_OPS_WEBHOOK;

const targetDate = (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);       // previous UTC day
  return d.toISOString().slice(0, 10);
})();

async function main() {
  const client = await pool.connect();
  try {
    // Trials whose 7-day window ended on or before targetDate, bucketed.
    // converted = that user is currently paying (subscription_status='active').
    const res = await client.query(`
      SELECT
        COUNT(*)                                        AS trials_closed,
        COUNT(*) FILTER (WHERE subscription_status='active') AS converted
      FROM users
      WHERE stripe_trial_end IS NOT NULL
        AND date_trunc('day', stripe_trial_end) <= $1::date
        AND date_trunc('day', stripe_trial_end) >= $1::date - INTERVAL '6 days'
        AND subscription_status IN ('active','canceled','past_due','unpaid','no_subscription')
    `, [targetDate]);

    const { trials_closed = 0, converted = 0 } = res.rows[0] || {};
    const rate = trials_closed > 0 ? ((converted / trials_closed) * 100).toFixed(1) + '%' : 'n/a';

    // NEW: new signups on the target date, broken down by attribution source
    // (set from ?utm_source=... cookie at registration). Lets you see which
    // channel (facebook, reddit, direct, ...) actually produces signups.
    const src = await client.query(`
      SELECT COALESCE(NULLIF(utm_source,''),'direct') AS channel, COUNT(*) AS n
      FROM users
      WHERE created_at::date = $1::date
      GROUP BY 1 ORDER BY 2 DESC
    `, [targetDate]);
    const channelRows = src.rows || [];
    const totalNew = channelRows.reduce((a, r) => a + Number(r.n), 0);

    console.log(`[daily-conversion-report] ${targetDate}: ${converted}/${trials_closed} = ${rate} | new signups: ${totalNew} (${JSON.stringify(channelRows)})`);

    const channelHtml = channelRows.length
      ? `<p style="margin-top:12px"><b>New signups by channel (${totalNew} total):</b></p>
         <ul>${channelRows.map(r => `<li><b>${r.channel}</b>: ${r.n}</li>`).join('')}</ul>`
      : `<p style="margin-top:12px;color:#888">No new signups on ${targetDate}.</p>`;

    const body = wrapH1(
      `<p>Trial → paid conversion for <b>${targetDate}</b>:</p>
       <h2 style="font-size:28px;margin:8px 0">${rate}</h2>
       <p>${converted} converted · ${trials_closed} trials closed (7-day windows ending on/before that day)</p>
       ${channelHtml}
       <p>Full dashboard: <a href="https://letsmakeai.fun/settings">letsmakeai.fun</a></p>`
    );

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Skyler @ HomeworkHelper <skyler@letsmakeai.fun>',
      to: ADMIN_EMAIL,
      subject: `HH Conversion Report — ${targetDate}: ${rate}`,
      html: body,
    });

    await sendDiscordAlert(
      DISCORD, 'Daily Conversion Report',
      `${targetDate}: ${converted}/${trials_closed} = ${rate}`,
      converted > 0 ? 'success' : 'info',
      [
        { name: 'Converted', value: converted, inline: true },
        { name: 'Trials Closed', value: trials_closed, inline: true },
        { name: 'Rate', value: rate, inline: true },
      ]
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('[daily-conversion-report] failed:', err);
  process.exit(1);
});