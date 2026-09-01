# HomeworkHelper X/Twitter Marketing System

**Date:** 2026-09-01
**Status:** Architecture complete; awaiting credentials to enable publishing

---

## 1. Architecture Overview

```
content/scheduled/x_posts/         ← markdown drafts (human-edited + AI-suggested)
       ↓
scripts/ops/x-post-pipeline.js    ← reads drafts, A/B-tests, schedules, queues
       ↓
scheduled_content table           ← DB-backed queue with status (draft → approved → published)
       ↓
scripts/ops/x-post-publisher.js   ← publishes via xurl CLI when credentials present
       ↓
scripts/ops/x-engagement-tracker.js ← monitors likes/replies/retweets (post-API)
       ↓
Discord alerts on anomalies
```

---

## 2. Credential Status

| Item | Status | Required Action |
|------|--------|-----------------|
| `xurl` CLI installed | ✅ `/home/ibcnu/.local/bin/xurl` | none |
| X/Twitter API credentials | ❌ **MISSING** | User must run `xurl auth` or provide `X_BEARER_TOKEN`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` |
| Authenticated X account | ❌ unverified | User must confirm `@ibcnu8989` is the intended marketing account |

**Without credentials:** the system runs in **draft-only mode** — content is generated, queued in the DB, and held for approval. The user reviews each post manually and can publish via `xurl post "..."` themselves, or set credentials to enable auto-publish.

---

## 3. Content Pillars (5 themes)

| Pillar | Frequency | Goal |
|--------|-----------|------|
| **Teacher pain points** | 4x/week | Resonate, build empathy |
| **Behind-the-scenes / founder** | 1x/week | Trust, transparency |
| **Product tips & use cases** | 4x/week | Discovery, conversion |
| **Question / engagement** | 2x/week | Replies, follows |
| **Customer wins / testimonials** | 2x/week | Social proof (only when real) |

Total: ~13 posts/week. Mirrors the existing `content/social-calendar-30day.md` plan.

---

## 4. Content Schema (DB + draft)

Each post has:

```yaml
id: uuid
content_id: "x-001-2026-09-02"           # human-readable
topic: "Why teachers dread weekends"     # topic theme
category: "teacher_pain_points"          # pillar
post_text: "..."                         # final copy (≤280 chars for single, ≤25 tweets for thread)
thread_continuation: ["tweet 2 text", "tweet 3 text"]  # optional
media_url: ""                            # optional image/video
cta: "Try HomeworkHelper free"           # optional CTA line
status: "draft"                          # draft | approved | scheduled | published | rejected
scheduled_at: "2026-09-02T14:00:00Z"
published_at: null
published_id: ""                         # X post ID after publish
platform: "x"
source_reference: "social-calendar-30day.md#week1-day2"
approval_status: "pending_review"        # pending_review | human_approved | auto
performance_metrics: null                # populated post-publish
created_at: "..."
updated_at: "..."
```

DB table: use existing `scheduled_content` (already in `marketing-schema.sql`). It already has: id, title, content_type, text, platforms, status, publish_at, published_at, error, meta, created_at, updated_at. We map:
- `content_type = 'twitter_post'` or `'twitter_thread'`
- `title = topic`
- `text = post_text`
- `platforms = ['twitter']`
- `status = draft | approved | scheduled | published | rejected`
- `publish_at = scheduled_at`
- `published_at`, `error` as-is
- `meta = JSON with {category, cta, media_url, thread_continuation, source_reference, performance_metrics, approval_status}`

---

## 5. Content Drafts (initial 14 — week 1)

These will be written into `content/scheduled/x_posts/week1.md` as draft specs. They cover all 5 pillars and avoid the "BUY OUR APP" trap.

See `content/scheduled/x_posts/week1.md` (created in Phase 11).

---

## 6. Pipeline (scripted, runs daily)

`scripts/ops/x-post-pipeline.js` — runs Mon-Fri at 8 AM:
1. Read all `scheduled_content` rows where `content_type LIKE 'twitter%'` AND `status='approved'` AND `publish_at <= NOW()`
2. For each, if X credentials present → call `xurl post "<text>"` → record `published_at` + `published_id`
3. If credentials missing → log "[DRAFT-ONLY] would post: <text>" and leave `status='approved'` (don't auto-mark published)
4. Update `status='published'` on success, `status='failed'` on error (with `error` message)

`scripts/ops/x-engagement-tracker.js` — runs daily at 9 PM:
1. For posts `published_at > NOW() - INTERVAL '7 days'`, call `xurl` to fetch likes/replies/retweets
2. Store in `meta.performance_metrics` JSONB

---

## 7. Approval Boundary

**No automated publishing.** Every draft enters as `approval_status = 'pending_review'`. A human (or batch human-review prompt) must approve before `status='approved'`. The script will never publish a draft that doesn't have `approval_status='human_approved'`.

This is a deliberate safety mechanism — the user's X account reputation must be protected.

---

## 8. Cron Schedule

| Cron | Schedule | Action |
|------|----------|--------|
| `x-post-pipeline-daily` | `0 8 * * 1-5` | Publish approved posts due |
| `x-engagement-daily` | `0 21 * * *` | Pull engagement metrics |
| `x-content-ideation-weekly` | `0 9 * * 1` | Generate 5 new draft ideas (LLM-driven, no publish) |

---

## 9. Failure Modes

- **X API down** — log + retry on next run, alert Discord
- **Post rejected by X** — record `error`, mark `status='rejected'`, alert Discord
- **Token expired** — alert Discord, fail-closed (no further publishes until reauth)
- **Account suspended** — alert Discord, freeze all publishing

---

## 10. Files To Create (Phase 8 deliverable)

- `scripts/ops/x-post-pipeline.js`
- `scripts/ops/x-engagement-tracker.js`
- `content/scheduled/x_posts/week1.md` (14 draft posts)
- Cron jobs: `x-post-pipeline-daily`, `x-engagement-daily`, `x-content-ideation-weekly`
- `reports/social_media_pipeline.md` (this file)

---

## 11. Required Human Action (to enable publishing)

1. Run `xurl auth` and follow the OAuth flow OR
2. Provide these Railway env vars:
   - `X_BEARER_TOKEN`
   - `X_API_KEY`
   - `X_API_SECRET`
   - `X_ACCESS_TOKEN`
   - `X_ACCESS_SECRET`
3. Confirm the authenticated handle is `@ibcnu8989`
4. (Once set) Run the publish-pipeline manually to test one post, then enable the cron

Until credentials are provided, the system runs in **draft + queue only** mode — useful for content planning but cannot publish.

---

## 12. Why X First (not LinkedIn/FB)

Per the user's earlier direction (Aug 30 session):
- Facebook / Instagram / Reddit / LinkedIn = walled garden, low ROI for automation
- X/Twitter = **best ROI** — `xurl` works with user's authenticated session, no app review needed
- YouTube = read-only (transcripts only), no auto-publish
- This mission builds X first, leaves others for later
