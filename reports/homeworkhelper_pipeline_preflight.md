# HomeworkHelper Pipeline Pre-Flight Audit

**Mission:** Resume HH pipeline — email sequencer + cron jobs + X/blog
**Date:** 2026-09-01
**Auditor:** Hermes Agent
**Status:** Phase 0 complete — read-only inventory of all systems

---

## 1. Discovered Systems

### 1.1 Production Application
- **Repo:** `/home/ibcnu/HHproduction-workdir` (branch: `main`)
- **Remote:** `https://github.com/ibcnu89/HHproduction`
- **Hosting:** Railway (auto-deploy on push to `main`)
- **Domain:** `letsmakeai.fun` (App at `/apps/homeworkhelper`, hub at `/`)
- **DB:** Postgres on Railway (Neon-backed)
- **Email provider:** Resend (from `skyler@letsmakeai.fun` / "Skyler @ HomeworkHelper")
- **Auth:** Email/password + Google OAuth
- **Billing:** Stripe (monthly + new 9-month annual plan)

### 1.2 Outreach / Lead-gen Stack
- **Canonical lead dataset:** `outreach_prospects` table (Neon Postgres)
  - Fields: `email`, `first_name`, `last_name`, `school`, `district`, `state`, `subject`, `grade_level`, `source`, `pain_point`, `priority`, `status`, `touch_count`, `last_contacted`, `last_template`
  - Status enum: `new` → `contacted` → `replied` / `interested` / `unsubscribed` / `bounced`
- **Source data:** `prospects/outreach_db.json` (JSON mirror, 119 verified leads from NCES)
- **Lead discovery:** `scripts/ops/enrich-nces.py` (NCES school directory → teacher enrichment waterfall)
- **Email sequencer:** `scripts/ops/run-sequences.js` — 6-touch (call, email, call, linkedin, email, email)
- **Daily batch sender:** `scripts/ops/send-outreach-batch.js`
- **Resend inbound webhook:** `scripts/ops/resend-webhook-server.js` (sentiment → `outreach_replies`)
- **Sequence init:** `scripts/ops/init-sequences.js` (creates sequence rows for new prospects)

### 1.3 User Lifecycle Stack (HH signups, separate from outreach)
- **Tables:** `users` + `user_drip_emails` (migration 015)
- **New columns on `users`:** `high_intent`, `welcome_drip_started_at`, `trial_expired_at`, `winback_sent_at`
- **Scripts (in `scripts/ops/lifecycle/`):** `welcome-drip-enroll.js`, `welcome-drip-send.js`, `high-intent-scorer.js`, `winback-send.js`, `daily-conversion-report.js`, `signup-watcher.js`, `bulk-init-sequences.js`, `channel-dashboard.js`
- **Email drafts:** `content/scheduled/onboarding-email-{01,02,03}.md` (static, currently draft, may need rewiring)
- **Note:** These are SIGNUP drip — separate from cold outreach. They target the `users` table.

### 1.4 Marketing / Content
- **Tables:** `scheduled_content`, `content_performance`, `marketing_spend`, `mrr_snapshots`, `outreach_templates`
- **Published content:** `content/published/`
- **Scheduled content:** `content/scheduled/launch-blog-01.md`
- **30-day social calendar:** `content/social-calendar-30day.md`
- **Week-1 launch:** `content/week1-social-launch-fb-reddit.md`
- **Publisher:** `scripts/ops/publish-scheduled-content.js`

### 1.5 Cron / Scheduling Infrastructure
- **GitHub Actions workflows (3):**
  1. `.github/workflows/cron-jobs.yml` — primary (8 jobs: health, MRR, webhook verify, outreach batch, trial expiry, weekly publish, db backup, SSL)
  2. `.github/workflows/crons.yml` — **DUPLICATE; schedule section already commented out** (2026-08-17 disable note)
  3. `.github/workflows/lifecycle-crons.yml` — user-lifecycle (welcome drip, high-intent, winback, conversion report, signup watcher)
- **Hermes cron jobs (7 paused):** See `cron_job_classification.md`
- **Railway cron jobs:** None found at this scope (Railway = app only)

### 1.6 Social Media Tooling
- **X/Twitter:** No `xurl` config, no tokens, no scheduler. Content drafts exist in `content/social-calendar-30day.md` (30 days of post ideas). **No active X account verified.**
- **Facebook/Reddit/LinkedIn:** Skipped per user ("FB/IG/Reddit/LinkedIn = walled garden").
- **YouTube:** `youtube-content` skill available but unused.
- **Skills available but not yet wired:** `xurl`, `youtube-content`, `social-media-marketing-automation`

### 1.7 Blog / Content Tooling
- **No CMS.** Content is stored as markdown files in `content/scheduled/` and `content/published/`.
- **Publisher script:** `publish-scheduled-content.js` (not investigated deeply yet — appears to read `scheduled_content` table).
- **No blog domain / subpath identified** (could use `letsmakeai.fun/blog` or subdomain — needs decision).

### 1.8 Available Skills (relevant)
- `xurl` — X/Twitter via CLI
- `youtube-content` — YT transcripts/summaries
- `social-media-marketing-automation` — multi-platform discovery
- `blogwatcher` — RSS/Atom monitoring
- `competitor-news-monitor`
- `grounded-citations` — verify claims before publishing

---

## 2. Cron Jobs — Current State (All Paused)

| # | Job ID | Name | Schedule | What it does | Project |
|---|--------|------|----------|--------------|---------|
| 1 | `914beaeea4ea` | `crypto-lending-yield` | `0 * * * *` | DeFi yield monitor | **UNRELATED** |
| 2 | `4c48b058f886` | `passive-income-watchdog` | `*/5 * * * *` | Income streams check | **UNRELATED** |
| 3 | `7888abe8fe12` | `passive-income-unified` | `*/10 * * * *` | Unified passive-income | **UNRELATED** |
| 4 | `e86fba0d1562` | `pipeline_collect` | `every 60m` | `~/.hermes/scripts/pipeline_collect.sh` | **UNRELATED** |
| 5 | `c92ebc7470da` | `marketplace-auto-start` | `*/5 * * * *` | NFT marketplace server | **UNRELATED** |
| 6 | `a68fd9a0e34d` | `sequence-runner-daily` | `0 10 * * 1-5` | `run-sequences.js` — outreach emails | **HH-RELEVANT** |
| 7 | `cc38021fe2ad` | `teacher-lead-discovery` | `every 360m` | NCES teacher discovery | **HH-RELEVANT** |

(Detailed classification + evidence: see `cron_job_classification.md`.)

### GitHub Actions (Railway/Railway-env scheduled):
- `cron-jobs.yml` — health, MRR, webhook verify, outreach batch, trial expiry, weekly content publish, db backup, SSL (8 jobs) — all **HH-relevant infrastructure**
- `lifecycle-crons.yml` — welcome drip, high-intent, winback, daily report, signup watcher — **HH-relevant**
- `crons.yml` — duplicate; **already disabled** (schedule commented out 2026-08-17). Manual `workflow_dispatch` retained. No action needed.

---

## 3. Email Pipeline Path

```
Lead source (NCES / Reddit / referral)
  → enrich-nces.py / enrich-emails-v3.py (waterfall email enrichment)
    → outreach_prospects table (UNIQUE on email)
      → init-sequences.js (creates outreach_sequences + outreach_sequence_steps rows)
        → run-sequences.js (daily 10 AM Mon-Fri):
            • looks up active sequences where next_due_at <= NOW()
            • picks pending step
            • renders EMAIL_TEMPLATES[templateKey] via personalizeTemplate()
            • sends via Resend from skyler@letsmakeai.fun
            • logs to outreach_sequence_steps (status, sent_at, result)
            • advances outreach_sequences.current_step
        → resend-webhook-server.js (inbound replies):
            • sentiment classification
            • → outreach_replies table
            • → outreach_prospects.status = 'replied'
            • → outreach_sequences.reply_received = TRUE (auto-pauses further steps)
  → Discord alert on each send
```

**Confirmation of canonical dataset:** All scripts query `outreach_prospects` (UNIQUE on email). No Vercel references found. No test recipient in code (FROM is prod). No development email provider in code paths.

**Current first-touch template (the one to rewrite):** see `scripts/ops/run-sequences.js` lines 41-46 — opens "I'm Skyler, founder of HomeworkHelper" — too matter-of-fact, low hook, no problem-first framing.

---

## 4. Safety / Promotion Controls — Current State

| Control | Where | Status |
|---------|-------|--------|
| **Suppression / unsubscribe** | `outreach_prospects.status = 'unsubscribed'` checked in queries; not seen to be auto-checked in sequencer query | **GAP — sequencer doesn't filter on status** |
| **Duplicate prevention** | `outreach_prospects.email` is `UNIQUE`; sequence runner checks existing active sequence | ✅ |
| **Reply detection (auto-pause)** | `outreach_sequences.reply_received = TRUE` filters out | ✅ |
| **Bounce handling** | Status field exists; auto-update path not verified in run-sequences.js | **NEEDS VERIFICATION** |
| **Sending rate limit** | None hardcoded in `run-sequences.js` — limited only by daily cron run count | **NEEDS LIMIT** (e.g. cap per run) |
| **A/B testing** | `outreach_ab_results` table; `day2_email` subject test | ✅ (but only on step 1 — Day 2 email, not the first touch) |
| **Opt-out link in email body** | Not present in current template | **MISSING — need to add** |
| **Discord alert on send** | ✅ | ✅ |
| **Dry-run mode** | `RESEND_API_KEY` unset → dry-run logs only | ✅ (useful for testing) |
| **Circuit breaker / backoff** | Not present in `run-sequences.js` | **GAP — need to add** |
| **Per-recipient throttle** | None | **GAP** |

---

## 5. Risks Discovered

1. **First-touch template is weak** — generic "I'm Skyler" opening, no problem hook, no curiosity. Will hurt reply rate.
2. **No unsubscribe link in current email body** — CAN-SPAM / deliverability risk.
3. **No per-run send cap** — if the queue grows, a single cron run could send a large batch. Need a hard daily/hourly cap.
4. **Sequencer doesn't filter `outreach_prospects.status = 'unsubscribed'` or `bounced'`** at the prospect level — relies on `outreach_sequences.reply_received` only. Need to add explicit filter.
5. **Resend API key was previously exposed and revoked** (per memory). Need to confirm the new one is in env (not in repo).
6. **No circuit breakers in run-sequences.js** — if Resend returns 429 mid-run, the script doesn't pause/back off.
7. **GitHub Actions `crons.yml`** — schedule is disabled but file still exists. Not a current risk; noted for cleanup later.
8. **Outreach prospects dataset is small** — 119 verified leads. Cold outreach scale is bounded by enrichment quality, not sending.
9. **X/Twitter account unverified** — user has `twitter.com/ibcnu8989` linked in landing page footer. Need to confirm if this is the marketing account. No API credentials present.
10. **Blog has no domain/subpath** — content sits in `content/scheduled/` markdown files. Need to decide: subdomain? `letsmakeai.fun/blog`? separate Medium/Substack?

---

## 6. Recommended Next Actions (Phase Order)

1. **Phase 1** — Classify and reactivate ONLY `sequence-runner-daily` and `teacher-lead-discovery` Hermes crons. Leave all unrelated paused.
2. **Phase 2** — Audit full email path; verify Resend key health; check `outreach_prospects` status enum coverage; confirm no stale Vercel/test sends.
3. **Phase 3** — Write 3 candidate first-touch templates (problem-first, curiosity-driven, pattern-interruption); score; pick winner.
4. **Phase 4** — Render winner against test dataset (missing names, special chars, long orgs, apostrophes, unicode). Reject if any `None` / `null` / `undefined` / blank.
5. **Phase 5** — Add hard safety controls: unsubscribe link, per-run cap (e.g. 20/day), bounced/unsubscribed filter, 429 backoff.
6. **Phase 6** — Controlled canary (small batch) using new template. Monitor.
7. **Phase 7** — If canary healthy, allow sequencer to resume under existing schedule.
8. **Phase 8** — X/Twitter: confirm account, design content queue, document credential boundary.
9. **Phase 9** — Blog: design topic → article pipeline; decide publishing destination.
10. **Phase 10** — Cross-channel loop: blog → X thread → X standalone → email content.
11. **Phase 11+** — Observability + final audit.

---

## 7. Open Questions for Human (NOT blocking Phase 1-2)

- Confirm X/Twitter handle: is `@ibcnu8989` the marketing account? (footer link on `letsmakeai.fun` says yes — but no API creds.)
- Blog publishing destination: `letsmakeai.fun/blog` subdomain? GitHub Pages? Medium? Substack? Static export from this repo?
- Unsubscribed-list scope: do we honor prior `unsubscribed` rows from legacy systems, or reset for new template?
- Win-back offer: 20% or 30% for the Day-1 win-back (not blocking outreach reactivation, blocking lifecycle drip).
- Should `bulk-init-sequences.js` re-enroll already-contacted leads in the new sequence, or skip them?

---

## 8. Files Created This Phase

- `reports/homeworkhelper_pipeline_preflight.md` (this file)
- `state/homeworkhelper_marketing_mission.json` (checkpoint)
