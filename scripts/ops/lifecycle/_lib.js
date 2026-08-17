#!/usr/bin/env node
/**
 * Shared helpers for the HHproduction user-lifecycle email engine.
 * Reused by: welcome-drip-enroll, welcome-drip-send, high-intent-scorer,
 *            winback-send, daily-conversion-report.
 *
 * Env: DATABASE_URL, RESEND_API_KEY, DISCORD_OPS_WEBHOOK (optional),
 *      ALLOWLIST_EMAIL (admin recipient for reports)
 */
import pg from 'pg';
import { Resend } from 'resend';

export const FROM_EMAIL = 'Skyler @ HomeworkHelper <skyler@letsmakeai.fun>';
export const ADMIN_EMAIL = process.env.ALLOWLIST_EMAIL || 'skyler@letsmakeai.fun';
export const APP_URL = 'https://letsmakeai.fun';

export function getPool() {
  return new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
}

export function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const COLORS = { info: 0x3b82f6, success: 0x22c55e, warning: 0xf59e0b, critical: 0xef4444 };
const EMOJIS = { info: 'ℹ️', success: '✅', warning: '⚠️', critical: '🚨' };

export async function sendDiscordAlert(webhook, title, description, level = 'info', fields = []) {
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: `${EMOJIS[level]} ${title}`,
          description,
          color: COLORS[level],
          timestamp: new Date().toISOString(),
          fields: fields.map(f => ({ name: f.name, value: f.value, inline: f.inline ?? true })),
          footer: { text: 'HHproduction Lifecycle' },
        }],
      }),
    });
  } catch (e) { /* swallow */ }
}

/**
 * Send an email and log it to user_drip_emails (idempotent: UNIQUE user+type).
 * Returns { sent: boolean, logged: boolean, error? }.
 */
export async function sendAndLog(pool, resend, { userId, email, emailType, subject, html, variant='standard' }) {
  // Idempotency guard: never double-send the same type to the same user.
  const dup = await pool.query(
    'SELECT 1 FROM user_drip_emails WHERE user_id=$1 AND email_type=$2 LIMIT 1',
    [userId, emailType]
  );
  if (dup.rows.length) return { sent: false, logged: true, skip: 'already_sent' };

  try {
    const r = await resend.emails.send({ from: FROM_EMAIL, to: email, subject, html });
    const resendId = r?.data?.id || null;
    await pool.query(
      `INSERT INTO user_drip_emails (user_id, email_type, variant, subject, resend_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [userId, emailType, variant, subject, resendId]
    );
    return { sent: true, logged: true, resendId };
  } catch (err) {
    // Log failure so retry is possible (not inserted -> not marked sent).
    return { sent: false, logged: false, error: err.message };
  }
}

export function wrapH1(body) {
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:auto;color:#1a1a1a"><p>Hi {{name}},</p>${body}<hr style="border:none;border-top:1px solid #eee;margin:24px 0"><p style="color:#888;font-size:12px">HomeworkHelper · AI grading for teachers · <a href="${APP_URL}/settings">Preferences</a></p></div>`;
}