#!/usr/bin/env node
/**
 * Welcome Drip — Send (daily cron)
 * For each enrolled trialing user, compute which drip emails are due and send
 * the ones not yet sent.
 *
 * Cadence (standard, 7-day):
 *   Day 1 -> drip_day1  Onboarding   (reuses onboarding-email-01.md)
 *   Day 3 -> drip_day3  Feature      (reuses onboarding-email-02.md: Custom Rubrics)
 *   Day 5 -> drip_day5  Social proof (reuses onboarding-email-03.md: Batch grading / Mrs. Torres)
 *   Day 7 -> drip_day7  Expiring-trial warning
 *
 * Cadence (high_intent, shortened to 5 days): created by high-intent-scorer.
 *   Day 1 -> drip_day1  Onboarding
 *   Day 3 -> drip_day3  Feature highlight
 *   Day 5 -> drip_day5  Expiring-trial warning (SOCIAL PROOF SKIPPED)
 *
 * Sends are idempotent via user_drip_emails (UNIQUE user+type).
 *
 * Schedule: 0 9 * * *  (daily 9 AM UTC)
 */
import { getPool, getResend, sendAndLog, sendDiscordAlert, APP_URL } from './_lib.js';

const pool = getPool();
const resend = getResend();
const DISCORD = process.env.DISCORD_OPS_WEBHOOK;

// Old preview host baked into the draft .md files — replace with the live app.
const PRODUCT_URL = `${APP_URL}/apps/homeworkhelper`;

const CTA = (label, href) =>
  `<p><a href="${href}" style="display:inline-block;padding:12px 24px;background:#f59e0b;color:white;text-decoration:none;border-radius:6px;font-weight:bold">${label}</a></p>`;

// map: (day, isHighIntent) -> emailType  |  null = skip this day
function emailForDay(day, highIntent) {
  if (highIntent) {
    return { 1: 'drip_day1', 3: 'drip_day3', 5: 'drip_day7' }[day] || null;
  }
  return { 1: 'drip_day1', 3: 'drip_day3', 5: 'drip_day5', 7: 'drip_day7' }[day] || null;
}

const SUBJECTS = {
  drip_day1: "You're in — get your first class graded in 5 minutes",
  drip_day3: "Custom rubrics = your department's secret weapon",
  drip_day5: 'Batch-grade 30 papers while your coffee brews',
  drip_day7: 'Last day to keep unlimited AI grading',
};

// Convert the draft markdown into an email body, wrapped in the sender shell.
function draftBody(bodyHtml) {
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:auto;color:#1a1a1a;font-size:15px;line-height:1.6">${bodyHtml}</div>`;
}

function renderHtml(emailType, name) {
  const n = name || 'there';
  const greeting = `<p>Hi ${n},</p>\n`;
  const signoff = `<p>— Skyler</p><hr style="border:none;border-top:1px solid #eee;margin:24px 0"><p style="color:#888;font-size:12px">HomeworkHelper · AI grading for teachers · <a href="${APP_URL}/settings">Preferences</a></p>`;

  switch (emailType) {
    // Reuses content/scheduled/onboarding-email-01.md (you're in + first grade in 5 min).
    case 'drip_day1':
      return draftBody(
        greeting +
        `<p>You're in. Welcome to HomeworkHelper.</p>
         <p><b>Your 7-day trial starts now.</b> Here's how to get your first graded assignment in 5 minutes:</p>
         <h3 style="margin:18px 0 8px">1️⃣ Pick your setup (30 seconds)</h3>
         <ul><li><b>Grade level:</b> K–12</li><li><b>Subject:</b> Math, ELA, Science, Social Studies</li><li><b>Standards:</b> your state's learning standards</li></ul>
         <h3 style="margin:18px 0 8px">2️⃣ Snap &amp; grade (2 minutes)</h3>
         <ul><li>Open the app on your phone</li><li>Tap "New Assignment"</li><li>Photograph one student's paper</li><li>Tap "Grade"</li></ul>
         <h3 style="margin:18px 0 8px">3️⃣ See the magic (30 seconds)</h3>
         <ul><li>✅ Correct / incorrect per question</li><li>📊 Standards mastery breakdown</li><li>✍️ Feedback your students can learn from</li></ul>
         ${CTA('Grade your first assignment', PRODUCT_URL)}
         <p>Reply anytime — I read every email.</p>` + signoff
      );

    // Reuses content/scheduled/onboarding-email-02.md (Custom Rubrics).
    case 'drip_day3':
      return draftBody(
        greeting +
        `<p>Yesterday you graded your first paper. Today: <b>make it yours</b>.</p>
         <p>Your district gives you a rubric. It's fine — but it doesn't match your essay prompts, your department's expectations, or the way <i>you</i> actually grade.</p>
         <h3 style="margin:18px 0 8px">Upload once, grade forever</h3>
         <p>Upload your rubric <b>ONE TIME</b> (PDF, image, or typed) → HomeworkHelper learns it → every future paper grades against <i>your</i> criteria.</p>
         <ul><li><b>Point breakdown per criterion</b> (Thesis 5pts, Evidence 10pts, Analysis 10pts, Mechanics 5pts)</li><li><b>Partial credit rules</b> ("Half credit for thesis attempt")</li><li><b>Grade-level adjustments</b> ("6th grade: prioritize structure")</li><li><b>Subject-specific</b> (lab reports, math work-showing, CER framework)</li></ul>
         <p><b>Real example — Mrs. Park's 8th grade science:</b></p>
         <p>She uploaded her <b>CER (Claim-Evidence-Reasoning)</b> rubric. Before: 15 min/paper × 120 = 30 hours. After: snap photo → 30 sec/paper = 1 hour. Her PLC now shares it — consistent grading across 4 teachers.</p>
         ${CTA('Upload your first rubric', `${PRODUCT_URL}#rubrics`)}
         <p>Tomorrow: batch-grade a full class set while your coffee brews.</p>` + signoff
      );

    // Reuses content/scheduled/onboarding-email-03.md (Batch grading / Mrs. Torres).
    case 'drip_day5':
      return draftBody(
        greeting +
        `<p>Now the workflow that saves weekends: <b>batch grading</b>.</p>
         <p><b>Old way:</b> take 30 papers home, grade at the kitchen table for 3 hours, enter grades next morning.</p>
         <p><b>New way:</b> keep papers at school, snap photos during prep (15 min), review flags in a grid, export CSV → gradebook in 2 min. Weekend: nothing.</p>
         <h3 style="margin:18px 0 8px">The 5-step batch workflow</h3>
         <ol><li><b>Collect</b> — the stack</li><li><b>Photograph</b> — tap, next, tap, next (a $12 phone stand helps)</li><li><b>Review</b> — grid of all 30; green check = confident, yellow flag = glance at it</li><li><b>Export</b> — CSV: Student, Score, %, Standards, Feedback</li><li><b>Import</b> — PowerSchool, Classroom, Skyward, Infinite Campus</li></ol>
         <p><b>Real numbers — Mrs. Torres (7th grade math, 150 students):</b></p>
         <blockquote style="margin:12px 0;padding:12px 16px;border-left:4px solid #f59e0b;background:#fff8ef">"First batch: 32 papers, 14 minutes. I timed it. Used to take 2+ hours — that's 1 hour 45 min I got back <b>every single assignment</b>."</blockquote>
         ${CTA('Start batch grading', `${PRODUCT_URL}#batch`)}
         <p><b>Day 5 of 7.</b> 2 days left on your trial.</p>` + signoff
      );

    // Expiring-trial warning (no existing draft covers this; strong urgency copy).
    case 'drip_day7':
      return draftBody(
        greeting +
        `<p>Heads up: <b>your free trial ends in 24 hours.</b></p>
         <p>If you've graded even one paper, you know the difference: feedback + letter grade on <b>every</b> question in ~30 seconds, aligned to your state standards.</p>
         <p>To keep unlimited AI grading (all subjects, all standards, handwriting OCR), just add a payment method. No lock-in — cancel anytime.</p>
         ${CTA('Keep unlimited access', `${APP_URL}/settings`)}
         <p>Questions? Hit reply. We're real people.</p>` + signoff
      );

    default:
      throw new Error(`unknown emailType ${emailType}`);
  }
}

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT id, email, name, welcome_drip_started,
             high_intent, drip_shortened, trial_expired_at
      FROM users
      WHERE subscription_status = 'trialing'
        AND welcome_drip_started IS NOT NULL
    `);

    const due = [];
    for (const u of res.rows) {
      const highIntent = !!u.high_intent;
      const daysSince = Math.floor((Date.now() - new Date(u.welcome_drip_started).getTime()) / 86400000);
      for (const day of highIntent ? [1, 3, 5] : [1, 3, 5, 7]) {
        if (daysSince >= day && daysSince < day + 1) {
          const type = emailForDay(day, highIntent);
          if (type) due.push({ u, type, subject: SUBJECTS[type], day });
        }
      }
    }

    console.log(`[welcome-drip-send] ${due.length} email(s) due today`);

    let sent = 0, failed = 0;
    for (const { u, type, subject } of due) {
      const html = renderHtml(type, u.name);
      const out = await sendAndLog(pool, resend, {
        userId: u.id, email: u.email, emailType: type,
        subject, html, variant: u.high_intent ? 'high_intent' : 'standard',
      });
      if (out.sent) { sent++; console.log(`  sent ${type} -> ${u.email}`); }
      else if (out.skip) { /* already sent */ }
      else { failed++; console.error(`  FAILED ${type} -> ${u.email}: ${out.error}`); }
      await new Promise(r => setTimeout(r, 900));
    }

    if (sent || failed) {
      await sendDiscordAlert(
        DISCORD, 'Welcome Drip: Sent',
        `${sent} sent, ${failed} failed`, failed ? 'warning' : 'success',
        [{ name: 'Sent', value: sent, inline: true }, { name: 'Failed', value: failed, inline: true }]
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('[welcome-drip-send] failed:', err);
  process.exit(1);
});