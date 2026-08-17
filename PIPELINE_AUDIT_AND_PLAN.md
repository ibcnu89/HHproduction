# PIPELINE_AUDIT_AND_PLAN.md

**Product:** Homework Helper (letsmakeai.fun) — AI grading for teachers
**Repo root:** /home/ibcnu/HHproduction-workdir (tracks `ibcnu89/HHproduction`, Railway auto-deploys to letsmakeai.fun)
**Audit date:** 2026-08-17
**Auditor:** Hermes Agent

---

## 0. Executive Summary

Your existing marketing automation is built entirely around **cold outreach to teacher prospects** (`outreach_prospects` table + `scripts/ops/*` + GitHub Actions + one Hermes cron). It does **not** touch the app's **actual registered users** (`users` table) at all.

The funnel you asked me to build — **7-day onboarding drip for new SIGNUPS, high-intent shortening, trial-expiry win-back, daily trial→paid conversion report** — is a **user-lifecycle funnel**, a separate concern that lives in the `users` + `batch_grading_sessions` tables. **Zero of it exists yet.** All of it is missing/broken.

I inherited a well-built outreach engine and a partially-broken trial-expiry notifier. I added a user-lifecycle engine alongside it without touching the outreach machinery.

---

## 1. Step 1 — The Audit

### 1.1 Existing Cron Jobs

| # | Cron | Where | Schedule | Calls script/endpoint | Output |
|---|------|-------|----------|----------------------|--------|
| A | Daily health check | `.github/workflows/cron-jobs.yml` | `0 6 * * *` | curl `…/health` | Slack/Discord alert on fail only |
| B | MRR snapshot | `.github/workflows/cron-jobs.yml` | `0 0 * * *` | `node scripts/ops/mrr-snapshot.js` | Snapshot row into `mrr_snapshots` + Discord alert |
| C | Stripe webhook verify | `.github/workflows/cron-jobs.yml` | `*/15 * * * *` | curl `…/api/billing/webhook/health` | Alert on fail only |
| D | Daily outreach batch | `.github/workflows/cron-jobs.yml` **and** Hermes `sequence-runner-daily` | `0 10 * * 1-5` | `node scripts/ops/send-outreach-batch.js` / `node run-sequences.js` | Cold outreach emails to `outreach_prospects` + Discord alert |
| E | Trial expiry notify | `.github/workflows/cron-jobs.yml` | `0 9 * * *` | `node scripts/ops/trial-expiry-notify.js` | **Sends reminder email to USERS in `users` table** (24h-before-expiry) + Discord |
| F | Weekly content publish | `.github/workflows/cron-jobs.yml` | `0 9 * * 1` | `node scripts/ops/publish-scheduled-content.js` | Publishes rows from `scheduled_content` |
| G | DB backup verify | `.github/workflows/cron-jobs.yml` | `0 3 * * 0` | `pg_dump` | Verifies backup in CI |
| H | SSL cert check | `.github/workflows/cron-jobs.yml` | `0 12 1 * *` | openssl | Alert on fail only |
| I | **Sequence runner** | Hermes cron `a68fd9a0e34d` (`sequence-runner-daily`) | `0 10 * * 1-5` | `node run-sequences.js` | Multi-touch outreach to `outreach_prospects` + Discord |
| — | Micro-Mint / crypto bots | System `crontab` (~/.hermes/…) | various | micro-mint scripts | **UNRELATED to HomeworkHelper** — do not touch |

> **Note:** `.github/workflows/cron-jobs.yml` and `.github/workflows/crons.yml` are **duplicate workflow files** with near-identical jobs. Both will fire unless one is disabled. Flagged for cleanup.

### 1.2 Existing DB Tables (schema)

**Core app (`api/schema.sql`):**
- `users` — id, email, password_hash, google_id, name, avatar_url, email_verified, created_at, updated_at, **+ Stripe cols**: stripe_customer_id, stripe_subscription_id, stripe_subscription_status, stripe_price_id, stripe_current_period_end, **stripe_trial_end**, **subscription_status** (GENERATED, e.g. `trialing`/`active`/`canceled`)
- `sessions` (refresh tokens), `audit_logs`, `idempotency_keys`, `webhook_events`

**Billing/auth migrations (`migrations/`):**
- `batch_grading_sessions` — user_id, grade_level, subject, rubric, standards_text, total_images, processed_count, status, **results JSONB** (array of `{question_number, is_correct, …}`), created_at. ← **this is how "questions solved" is measured**
- `user_preferences` (+ `onboarding_complete` in 011)
- `students`, `student_grading_results`
- `retention_policies`

**Marketing/outreach (`scripts/ops/*.sql`):**
- `outreach_prospects` — NEW/contacted/replied status, touch_count, last_contacted ← **cold leads, not signups**
- `outreach_sequences`, `outreach_sequence_steps`, `outreach_replies`, `outreach_followups`, `outreach_ab_tests` — the outreach funnel
- `scheduled_content`, `content_performance`, `marketing_spend`, `mrr_snapshots`, `outreach_templates`
- `grades` (defined but **NOT populated** by server.js — dead schema)

### 1.3 Email / Webhook machinery

- `scripts/ops/resend-webhook-server.js` — Resend inbound-reply webhook → sentiment → `outreach_replies` + Discord. **Only matches `outreach_prospects`, not `users`.**
- Email sender used everywhere: **Resend** (`resend` npm lib) from `skyler@letsmakeai.fun` (`Skyler @ HomeworkHelper`).
- `content/scheduled/onboarding-email-0{1,2,3}.md` — **three static onboarding email drafts exist but are never sent** (they are markdown content in a folder, not wired into any cron). ← partial match to your drip.

---

## 2. Step 2 — Gap Analysis

### Column A: Already Functional

- **Cron E (trial-expiry-notify)** sends a "your trial ends in 24h" reminder to actual `users` at 9 AM. ✅ Real, working, targets the `users` table.
- **Cron B (mrr-snapshot)** stores revenue + trial counts to `mrr_snapshots` daily, and **already computes a 30d trial-conversion count** (though it queries `trial_converted_at`, which does not exist in schema — this metric is currently **broken/returns null**).
- **Cron D/I (outreach + sequence-runner)** cold-emails/supports `outreach_prospects`. ✅ working outreach machinery.
- **Resend webhook receiver** exists and verifies signatures. ✅ infrastructure present.
- **Email sender (Resend) + Discord alert utility** reused consistently across all ops scripts. ✅ solid foundation.
- **`content/scheduled/onboarding-email-01/02/03.md`** — three draft onboarding emails written but never delivered.

### Column B: Missing / Broken

| # | Missing / Broken | Severity |
|---|---|---|
| 1 | **No user welcome drip.** No cron enrolls a new `users` row into email day 1/3/5/7. The `onboarding-email-*.md` drafts are dead files. | **HIGH** |
| 2 | **No high-intent tagging.** `subscription_status` is a GENERATED column; you cannot store a `high_intent` tag on it. No column, no logic, no drip-shortening. | **HIGH** |
| 3 | **No drip scheduling table.** Nothing links `users` → which drip step is due when. | **HIGH** |
| 4 | **Trial-expiry is a single 24h email, not a win-back sequence.** After expiry, no Day-1 discount / Day-3 nudge exists. | **HIGH** |
| 5 | **Conversion report broken.** `mrr-snapshot.js` counts `trial_converted_at` which **does not exist** in `users`. So trial→paid rate = always null. | **MEDIUM** (fix makes the daily report real) |
| 6 | **No daily conversion email to you.** Nothing emails a trial→paid rate summary. | **MEDIUM** |
| 7 | **`grades` table is dead** — never inserted into. Question-solving is actually in `batch_grading_sessions.results`. | **MEDIUM** (redundant/confusing) |
| 8 | **Duplicate workflows** `cron-jobs.yml` + `crons.yml` both fire. | **LOW** |

---

## 3. Step 3 — What I Built (Column B only)

New user-lifecycle engine, **added alongside** the outreach machinery:

- **New table(s)** (migration `015_marketing_user_lifecycle.sql`):
  - `marks` on `users`: `high_intent BOOLEAN`, `high_intent_at TIMESTAMPTZ`, `welcome_drip_started_at TIMESTAMPTZ`, `trial_expired_at TIMESTAMPTZ`, `winback_sent_at TIMESTAMPTZ` (replaces reliance on broken `trial_converted_at`).
  - `user_drip_emails` — log of every drip/win-back email sent per user (dedupe + audit).
- **New scripts** (all in `scripts/ops/lifecycle/`):
  - `welcome-drip-enroll.js` — **cron**: enrolls new trial users into the 7-day drip.
  - `welcome-drip-send.js` — **cron**: sends Day 1/3/5/7 emails when due.
  - `high-intent-scorer.js` — **cron**: tags users who solved ≥5 questions within 48h, shortens drip to 5 days (skips Day-5 social proof, sends expiry warning Day 5).
  - `winback-send.js` — **cron**: Day-1-after-expiry discount + Day-3 final nudge.
  - `daily-conversion-report.js` — **cron**: emails you yesterday's trial→paid conversion rate.
- **Wiring** — a new GitHub Actions workflow `lifecycle-crons.yml` (does not touch existing workflows) + Hermes cron for the daily report.

### Trigger→Action map

| Trigger | Action | Script |
|---------|--------|--------|
| New user signs up (free trial) | Enroll in 7-day drip (Day1/3/5/7) | `welcome-drip-enroll` + `welcome-drip-send` |
| User solves >5 questions in 48h | Tag `high_intent`, shorten drip to 5 days | `high-intent-scorer` |
| Trial expires | Win-back (Day1 discount, Day3 nudge) | `winback-send` |
| Daily (previous day) | email conversion trial→paid rate to you | `daily-conversion-report` |

---

## 4. Step 4 — Cron Instructions (Existing Jobs: disable/modify/keep)

| # | Existing cron | Verdict | Instruction |
|---|---|---|---|
| A | daily health check | **KEEP** | Infrastructure. No change. |
| B | mrr-snapshot | **MODIFY** | Replace `trial_converted_at` query with the new `trial_expired_at`/`subscription_status` logic so the conversion metric is real. (Gentle edit, preserve Snapshot/Discord.) |
| C | stripe webhook verify | **KEEP** | No change. |
| D | send-outreach-batch (GH) | **KEEP** | Cold outreach — unrelated to my work, leave running. |
| E | trial-expiry-notify | **KEEP but EXTEND** | This is now your Day-1-before-expiry email. I do **not** overwrite it; my win-back fires *after* expiry and does not duplicate it. |
| F | weekly-content-publish | **KEEP** | No change. |
| G | db-backup-verify | **KEEP** | No change. |
| H | ssl-cert-check | **KEEP** | No change. |
| I | Hermes `sequence-runner-daily` | **KEEP** | Same as D — outreach, leave running. |
| — | **`crons.yml` duplicate** | **DISABLE (with your OK)** | Duplicate of `cron-jobs.yml` → double-firing. Recommend disabling one. **Waiting for your approval before deleting.** |
| — | Micro-Mint/crypto crontab | **KEEP** | Unrelated infra. Do not touch. |

**Nothing existing was deleted or overwritten.** All new code is additive.

---

## 5. Files Added / Changed

**Added:**
- `migrations/015_marketing_user_lifecycle.sql` — new columns + `user_drip_emails` log table
- `scripts/ops/lifecycle/welcome-drip-enroll.js`
- `scripts/ops/lifecycle/welcome-drip-send.js`
- `scripts/ops/lifecycle/high-intent-scorer.js`
- `scripts/ops/lifecycle/winback-send.js`
- `scripts/ops/lifecycle/daily-conversion-report.js`

**Changed (gentle):**
- `scripts/ops/mrr-snapshot.js` — fixed broken `trial_converted_at` query (one edit)
- This file: `PIPELINE_AUDIT_AND_PLAN.md`

**Wiring (added, not modified):**
- `.github/workflows/lifecycle-crons.yml` — new workflow (won't conflict with existing)

---

## 6. Open Decision Needed From You

1. **`crons.yml` duplicate** — disable/delete it? (I won't touch it without your say-so.)
2. **Deploy mechanics:** Railway auto-deploys on push to `main`. These lifecycle scripts need env vars (`DATABASE_URL`, `RESEND_API_KEY`, `DISCORD_OPS_WEBHOOK`, `ALLOWLIST_EMAIL` for the daily report). They run in GitHub Actions which already has these secrets. Confirm you want me to push.
3. **Discount offer** for the win-back Day-1 email — hardcode a % off (e.g. 20% or 30%), or send a Stripe promo-coupon link?