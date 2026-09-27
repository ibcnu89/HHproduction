#!/usr/bin/env node
/**
 * Outreach Sender v2 — Phase 5 hardened first-touch sender.
 *
 * Replaces the run-sequences.js first-touch path with a fresh-start design:
 *   - Uses Candidate A first-touch template (problem-first, direct).
 *   - Hard unsubscribe link in every body.
 *   - Hard status filter (skips unsubscribed / bounced / replied / interested).
 *   - Hard per-run send cap (MAX_SENDS_PER_RUN env, default 20).
 *   - 429 / 5xx backoff with jitter.
 *   - Records last_template and touch_count on outreach_prospects.
 *   - A/B test on subject line.
 *   - Dry-run mode if RESEND_API_KEY unset.
 *
 * Schedule: this script is designed to be invoked from the
 * `sequence-runner-daily` Hermes cron OR manually as a canary.
 */

import pg from 'pg';

const { Pool } = pg;

// ── Safety configuration ───────────────────────────────────────────────
const MAX_SENDS_PER_RUN = parseInt(process.env.MAX_SENDS_PER_RUN || '20', 10);
const MAX_RETRIES_429 = 3;
const BACKOFF_BASE_MS = 2000;
const BACKOFF_MAX_MS = 60000;
const DELAY_BETWEEN_SENDS_MS = 1500;
const AB_TEST_NAME = 'first_touch_subject_v1';

// ── Resend setup ────────────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Skyler @ HomeworkHelper <skyler@letsmakeai.fun>';
const APP_URL = process.env.APP_URL || 'https://letsmakeai.fun';

if (!RESEND_API_KEY) {
  console.warn('⚠️  RESEND_API_KEY not set - running in DRY RUN mode (logs only, no send)');
}

// ── DB pool ─────────────────────────────────────────────────────────────
// TLS verification disabled for Railway/Neon cloud-managed certs (same
// pattern as run-sequences.js, render-harness.js, send-outreach-batch.js).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── Templates ───────────────────────────────────────────────────────────
// Candidate A from first_touch_template_review.md
const TEMPLATES = {
  subject: 'Sunday grading, again?',
  body: `Hi {{first_name_or_there}},

I noticed {{school_or_your_school}} has its hands full. Most weeks that means a stack of handwritten homework on someone's desk by Friday night.

Half of it doesn't really need a teacher. The arithmetic is right or wrong. The definitions are correct or they aren't. The citations are missing or they aren't.

What's left — the actual judgment calls — is buried under the bookkeeping a machine can handle in seconds.

That's what HomeworkHelper does. Photo the stack, get back standards-aligned scores + per-question feedback you can edit, and keep your Sundays.

It's free for 7 days. No card. Try it on one stack this weekend and see what you think.

→ [Start with one stack]({{register_url}})

If it's not useful, hit reply and tell me why — I read every one.

— Skyler
skyler@letsmakeai.fun

—
You're getting this because we thought HomeworkHelper might be useful for {{school_or_your_school}}.
[Unsubscribe]({{unsubscribe_url}}) · Reply STOP at any time.
`,
  subject_b: 'The 6-hour Sunday stack',
};

const FORBIDDEN_SUBSTRINGS = ['None', 'null', 'undefined', '{{', '}}', 'NaN', '[object Object]'];

function personalize(template, vars) {
  return Object.keys(vars).reduce((acc, key) => {
    const re = new RegExp(`{{${key}}}`, 'g');
    return acc.replace(re, vars[key]);
  }, template);
}

function checkLeak(text) {
  return FORBIDDEN_SUBSTRINGS.filter(b => text.includes(b));
}

function renderForProspect(p) {
  const firstName = (p.first_name || '').trim();
  const school = (p.school || '').trim();
  const vars = {
    first_name_or_there: firstName || 'there',
    school_or_your_school: school || 'your school',
    register_url: `${APP_URL}/auth?mode=register&utm_source=cold_email&utm_campaign=first_touch`,
    unsubscribe_url: `${APP_URL}/api/outreach/unsubscribe?token=${p.id}`,
  };
  return { vars, subject: personalize(TEMPLATES.subject, vars), body: personalize(TEMPLATES.body, vars) };
}

// ── Send with retry/backoff ─────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function jitter(ms) { return ms + Math.floor(Math.random() * Math.min(ms, 1000)); }

async function sendEmail({ to, subject, body, html }) {
  if (!RESEND_API_KEY) {
    console.log(`  [DRY RUN] → ${to} | subject="${subject.substring(0, 50)}"`);
    return { success: true, id: 'dry-run-' + Date.now(), dryRun: true };
  }

  let attempt = 0;
  let lastErr = null;
  while (attempt <= MAX_RETRIES_429) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [to],
          subject,
          text: body,
          html: html || body.replace(/\n/g, '<br>'),
          headers: {
            'List-Unsubscribe': `<${APP_URL}/api/outreach/unsubscribe?token=${encodeURIComponent(to)}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
          tags: [
            { name: 'campaign', value: 'first_touch_v1' },
            { name: 'source', value: 'outreach-send-v2' },
          ],
        }),
      });

      if (resp.status === 429) {
        attempt++;
        if (attempt > MAX_RETRIES_429) {
          return { success: false, error: `429 rate-limited after ${MAX_RETRIES_429} retries` };
        }
        const retryAfter = parseInt(resp.headers.get('Retry-After') || '0', 10) * 1000;
        const wait = Math.max(BACKOFF_BASE_MS, retryAfter) * Math.pow(2, attempt - 1);
        const delay = Math.min(BACKOFF_MAX_MS, jitter(wait));
        console.warn(`  ⏳ 429 rate limit. Retry ${attempt}/${MAX_RETRIES_429} in ${Math.round(delay/1000)}s`);
        await sleep(delay);
        continue;
      }

      if (resp.status >= 500) {
        attempt++;
        if (attempt > MAX_RETRIES_429) {
          return { success: false, error: `${resp.status} server error after ${MAX_RETRIES_429} retries` };
        }
        const delay = Math.min(BACKOFF_MAX_MS, jitter(BACKOFF_BASE_MS * Math.pow(2, attempt - 1)));
        console.warn(`  ⏳ ${resp.status} server error. Retry ${attempt}/${MAX_RETRIES_429} in ${Math.round(delay/1000)}s`);
        await sleep(delay);
        continue;
      }

      if (!resp.ok) {
        const txt = await resp.text();
        return { success: false, error: `${resp.status} ${txt.substring(0, 200)}` };
      }

      const data = await resp.json();
      return { success: true, id: data.id };
    } catch (e) {
      lastErr = e.message;
      attempt++;
      if (attempt > MAX_RETRIES_429) break;
      const delay = Math.min(BACKOFF_MAX_MS, jitter(BACKOFF_BASE_MS * Math.pow(2, attempt - 1)));
      console.warn(`  ⏳ Network error: ${e.message}. Retry ${attempt}/${MAX_RETRIES_429}`);
      await sleep(delay);
    }
  }
  return { success: false, error: lastErr || 'unknown failure' };
}

// ── A/B variant selection ───────────────────────────────────────────────
function pickVariant() {
  return Math.random() < 0.5 ? 'A' : 'B';
}

// ── Eligibility check ───────────────────────────────────────────────────
// Returns: { ok: true, prospect } | { ok: false, reason }
function checkEligibility(p) {
  if (!p.email || !p.email.includes('@')) return { ok: false, reason: 'no_email' };
  const excluded = ['unsubscribed', 'bounced', 'replied', 'interested'];
  if (excluded.includes(p.status)) return { ok: false, reason: `status_${p.status}` };
  return { ok: true, prospect: p };
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = new Date();
  console.log('=== Outreach Sender v2 — Fresh-Start First Touch ===');
  console.log(`Started: ${startedAt.toISOString()}`);
  console.log(`Max sends per run: ${MAX_SENDS_PER_RUN}`);
  console.log(`Mode: ${RESEND_API_KEY ? 'LIVE' : 'DRY RUN'}`);

  // Get eligible prospects (status NOT in suppression list, valid email)
  // Per user direction (2026-09-01): start over new. Email previously-contacted prospects
  // if they happen to be in the eligible set — gap since prior contact is sufficient.
  const { rows: prospects } = await pool.query(`
    SELECT p.id, p.email, p.first_name, p.last_name, p.school, p.state, p.district, p.subject, p.status
    FROM outreach_prospects p
    WHERE p.email IS NOT NULL
      AND p.email LIKE '%@%'
      AND p.status NOT IN ('unsubscribed', 'bounced', 'replied', 'interested')
    ORDER BY p.last_contacted ASC NULLS FIRST, p.id ASC
    LIMIT $1
  `, [MAX_SENDS_PER_RUN]);

  console.log(`Eligible prospects (status-filtered, ascending by last_contacted): ${prospects.length}`);

  // Ensure A/B test row exists
  await pool.query(`
    INSERT INTO outreach_ab_tests (name, variant_a_subject, variant_b_subject, active)
    VALUES ($1, $2, $3, TRUE)
    ON CONFLICT (name) DO NOTHING
  `, [AB_TEST_NAME, TEMPLATES.subject, TEMPLATES.subject_b]);

  let sent = 0, failed = 0, skipped = 0;
  const errors = [];

  for (const p of prospects) {
    const elig = checkEligibility(p);
    if (!elig.ok) {
      skipped++;
      console.log(`  SKIP ${p.email} (${elig.reason})`);
      continue;
    }

    const { vars, subject, body } = renderForProspect(p);
    const leaks = checkLeak(subject + body);
    if (leaks.length > 0) {
      failed++;
      errors.push({ prospect: p.email, error: `render leak: ${leaks.join(',')}` });
      console.error(`  ❌ RENDER LEAK ${p.email}: ${leaks.join(', ')}`);
      continue;
    }

    // A/B variant
    const variant = pickVariant();
    const finalSubject = variant === 'B' ? personalize(TEMPLATES.subject_b, vars) : subject;
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO outreach_ab_results (ab_test_id, prospect_id, variant)
        VALUES (
          (SELECT id FROM outreach_ab_tests WHERE name = $1),
          $2, $3
        )
        ON CONFLICT DO NOTHING
      `, [AB_TEST_NAME, p.id, variant]);
    } finally {
      client.release();
    }

    // Send
    const result = await sendEmail({
      to: p.email,
      subject: finalSubject,
      body,
    });

    if (result.success) {
      sent++;
      console.log(`  ✅ ${p.email} | variant=${variant} | id=${result.id}${result.dryRun ? ' (DRY)' : ''}`);
      // Update prospect state — record touch (last_template column doesn't exist
      // in this DB schema, so we just update touch_count and last_contacted).
      const upd = await pool.query(`
        UPDATE outreach_prospects
           SET touch_count = COALESCE(touch_count, 0) + 1,
               last_contacted = NOW(),
               status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END
         WHERE id = $1
      `, [p.id]);
    } else {
      failed++;
      errors.push({ prospect: p.email, error: result.error });
      console.error(`  ❌ ${p.email} | ${result.error}`);
    }

    // Inter-send delay
    if (sent + failed < prospects.length) {
      await sleep(DELAY_BETWEEN_SENDS_MS);
    }
  }

  console.log('\n=== Complete ===');
  console.log(`Sent: ${sent}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped (ineligible): ${skipped}`);
  if (errors.length > 0) {
    console.log(`First 3 errors:`);
    errors.slice(0, 3).forEach(e => console.log(`  - ${e.prospect}: ${e.error}`));
  }

  await pool.end();
  process.exit(failed > 5 ? 1 : 0);
}

main().catch(e => {
  console.error('Sender failed:', e);
  process.exit(2);
});
