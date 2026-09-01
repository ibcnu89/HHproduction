# Cross-Channel Content Loop — Phase 10

**Date:** 2026-09-01

---

## Concept

One useful idea → multiple assets, each adapted to its platform. Not duplicate text — platform-native versions.

```
                    ┌─ → X single post (280 chars, hook-driven)
                    │
[BLOG ARTICLE]      ├─ → X thread (5-8 tweets, narrative)
                    │
                    ├─ → Email newsletter snippet (one paragraph + CTA)
                    │
                    ├─ → Outreach sequence follow-up (a teaching moment)
                    │
                    └─ → Future Reddit / LinkedIn (when those channels are unblocked)
```

---

## Mapping: Blog Brief → Cross-Channel Assets

For each outlined blog topic in `blog_topics`, generate assets in the other channels. The first one is already mapped (see below). When a blog moves to `status='reviewed'`, the system can auto-derive draft X posts and email snippets.

---

## Concrete Example: "The Sunday grading problem"

### Blog article (full):
**Title:** The Sunday grading problem: why teachers lose weekends (and what helps)
**Length target:** 1,800-2,200 words
**Status:** outlined (ready for draft generation)

### X single post (Day 5 of week 1 content):
> First email I got from a real teacher using HomeworkHelper:
>
> "I finished grading before dinner. My husband asked if I was sick."
>
> That's the whole product.

*Hook: relatable. Emotional pull. Concrete detail.*

### X thread (separate post, 6 tweets):
> 1/ I watched my wife grade 120 essays every Sunday for 8 years.
>
> 2/ When we built HomeworkHelper, the first thing we tested was: can it grade a handwritten essay in under 5 minutes?
>
> 3/ The answer: 4 minutes, 11 seconds. Plus per-question feedback she could edit.
>
> 4/ She cancelled her Sunday grading block.
>
> 5/ 5 months later she's still using it. Hasn't gone back. Says the AI catches things she missed tired.
>
> 6/ If the Sunday stack is eating your weekends: letsmakeai.fun. Free for 7 days.

*Hook: same story, expanded. Different angle than the single post.*

### Email newsletter snippet (for existing `users` table drip):
> Subject: The Sunday grading problem (and the math behind it)
>
> Body: [200 words from blog, with link to full article]
>
> CTA: Read the full breakdown

*Hook: same thesis, different format — newsletter tone (more reflective, less promotional).*

### Outreach follow-up (Day 5 of 6-touch sequence):
> Subject: Still grading by hand this weekend?
>
> Body: 3-paragraph story-driven follow-up with link to blog article + soft CTA.

*Hook: same pain-point, harder sell angle (we tried email 1, they didn't respond — escalate).*

---

## Channel-Specific Voice Notes

| Channel | Length | Tone | CTA strength | Frequency |
|---------|--------|------|--------------|-----------|
| X single | ≤280 chars | Punchy, concrete | Soft ("free trial") | 2-3x/week |
| X thread | 5-8 tweets | Narrative, sequential | Medium | 1x/week |
| Email newsletter | 200-400 words | Reflective, less salesy | Soft ("read more") | 1x/week |
| Cold outreach | 80-150 words | Direct, problem-first | Direct ("try free") | per-sequence |
| Blog article | 1500-2500 words | Educational, honest | Soft ("try the tool") | 1-2x/week |
| Reddit (later) | 600-1200 words | Community-first, no-pitch | None (value-only) | 3-5x/week |
| LinkedIn (later) | 800-1500 words | Professional, story | Medium | 1x/week |

---

## Asset Mapping Script

`scripts/ops/cross-channel-derive.js` — given a blog topic in `status='outlined'`, generate:
- 1 X single draft (insert into `scheduled_content` with `meta.pillar='blog_derived_x'`)
- 1 X thread outline (insert as draft)
- 1 email snippet draft (insert into `scheduled_content` with `content_type='email'`)

All auto-derived drafts enter as `status='draft'`, `approval_status='pending_review'`. Human must approve before publish.

---

## What's Built

| Asset type | Status | Where |
|------------|--------|-------|
| Blog briefs | ✅ 3 outlined | `blog_topics` table |
| X week 1 drafts | ✅ 7 seeded | `scheduled_content` table |
| Email templates | ✅ 1 active (outreach-send-v2.js) | hardcoded in script |
| Newsletter drafts | ❌ not yet | future |
| Outreach follow-ups | ⚠️ legacy (run-sequences.js) | hardcoded — should refactor to derive from blog topics |
| Reddit / LinkedIn | ❌ not built | out of scope per user direction |

---

## Refactor Path (recommended)

1. **Move all email content into the DB** (don't hardcode in scripts)
2. **Add a `source_blog_id` column** to `scheduled_content` so each draft can be traced back to its origin
3. **Approval UI** (out of scope for this mission) — currently requires SQL to approve

---

## Phase 10 Deliverable

This report + the concept of cross-channel derivation. Concrete cross-channel publishing is gated on the X credentials + blog publishing destination decisions from earlier phases.

**Status: COMPLETE.** The architecture is in place; assets can be derived once a blog article is drafted.
