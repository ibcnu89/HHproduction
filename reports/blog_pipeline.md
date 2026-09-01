# HomeworkHelper Blog Engine — Architecture

**Date:** 2026-09-01
**Status:** Architecture complete; awaiting human decision on publishing destination

---

## 1. Current State

| Item | Status |
|------|--------|
| Existing `scheduled_content` table | ✅ exists in DB (used by `publish-scheduled-content.js`) |
| Existing `publish-scheduled-content.js` | ⚠️ stub (just `console.log` for each platform — no actual publish) |
| Blog subdomain (`blog.letsmakeai.fun`) | ❌ not configured |
| `/blog` route on main app | ❌ does not exist |
| MDX/Content layer | ❌ does not exist |
| CMS (Notion, Ghost, etc.) | ❌ not in use |
| SEO sitemap | ❌ does not include blog |
| `launch-blog-01.md` content draft | ⚠️ exists in `content/scheduled/` but never published |

---

## 2. Minimal Architecture — Decision Required

Per mission brief: *"If one exists, extend it. If none exists, design the smallest practical architecture rather than building an enormous publishing platform."*

There is no real blog system. Three minimal options:

### Option A: Static site generator (Astro/Hugo) deployed to `blog.letsmakeai.fun`
- **Pros:** Fast, SEO-perfect, no DB writes at request time, version-controlled content
- **Cons:** Requires Railway static-site service OR Netlify/Vercel, DNS config
- **Effort:** Medium (2-3 hours setup + DNS)
- **Publishing:** `git push` to content repo → auto-deploy
- **Domain:** Need to add `blog` subdomain to letsmakeai.fun DNS

### Option B: Add `/blog` route to the existing React/Vite app, served from main domain
- **Pros:** No new service, just React components, all on letsmakeai.fun
- **Cons:** Heavier JS for content pages (SEO slightly worse), need a content loader
- **Effort:** Small (1-2 hours)
- **Publishing:** Add posts as MDX files in src/content/blog/, commit to deploy
- **Domain:** Already letsmakeai.fun/blog

### Option C: Use Medium/Substack (no-code)
- **Pros:** Zero engineering, established SEO
- **Cons:** No domain control, branding diluted, separate analytics
- **Effort:** Minimal (1 hour)
- **Publishing:** Direct via Medium editor
- **Domain:** medium.com/@letsmakeai or substack domain

### ⏸️ **Recommended: Option A (static site)** for SEO + dev simplicity, but **awaiting user decision**

---

## 3. Content Pipeline (independent of destination)

The content creation flow is identical regardless of destination:

```
Topic discovery (Phase 9 deliverable)
  → search-intent analysis
  → article brief
  → outline
  → draft (LLM-assisted, human-reviewed)
  → factual review + originality check
  → SEO metadata
  → internal links + CTAs
  → PUBLICATION (varies by destination)
  → social promotion (Phase 10 loop)
```

---

## 4. Topic Discovery (Phase 9 concrete deliverable)

A topic pipeline that researches search intent for teacher-relevant queries. Initial topic candidates (from prior sessions and market research):

| Topic | Search intent | Pillar |
|-------|---------------|--------|
| "How to grade faster without losing quality" | How-to / pain-point | Teacher productivity |
| "AI grading for teachers: what works and what doesn't" | Comparison / trust | EdTech |
| "How to write a rubric that saves grading time" | How-to / evergreen | Grading |
| "The Sunday grading problem: why it exists and what to do" | Pain-point / story | Teacher life |
| "Photo grading: a teacher's guide to using your phone" | How-to | Product use case |
| "Common Core standards cheat sheet (K-12 by grade)" | Reference / SEO | Standards |
| "State standards alignment: IL, CA, NY, TX, FL, PA" | Reference / SEO | Standards |
| "Handwritten homework OCR: how accurate is it really?" | Tech deep-dive | AI/EdTech |
| "Free rubric templates for K-12 teachers" | Lead magnet | Grading |
| "Batch grading 50 papers in 15 minutes" | How-to / case study | Product |

These are seeded into `blog_topics` table for tracking.

---

## 5. DB Schema (additive — no breaking changes)

```sql
-- Blog topics (researched but not yet drafted)
CREATE TABLE IF NOT EXISTS blog_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  target_keyword TEXT,
  search_intent VARCHAR(50), -- informational | transactional | navigational | commercial
  pillar VARCHAR(50), -- teacher_productivity | grading | homework | edtech | standards | product
  outline JSONB, -- list of {h2: "...", points: [...]}
  meta_title VARCHAR(255),
  meta_description TEXT,
  internal_links JSONB DEFAULT '[]', -- [{url, anchor}]
  cta JSONB, -- {text, url, placement}
  status VARCHAR(20) DEFAULT 'idea', -- idea | outlined | drafted | reviewed | published | rejected
  body_md TEXT, -- article body in markdown
  body_html TEXT, -- rendered HTML
  author VARCHAR(100) DEFAULT 'Skyler @ HomeworkHelper',
  published_at TIMESTAMPTZ,
  url TEXT, -- final canonical URL
  seo_score INTEGER, -- 0-100
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_topics_status ON blog_topics(status, published_at);
CREATE INDEX IF NOT EXISTS idx_blog_topics_pillar ON blog_topics(pillar);
```

---

## 6. Pipeline Scripts

| Script | Purpose |
|--------|---------|
| `seed-blog-topics.js` | Insert the 10 initial topic candidates |
| `blog-brief-generator.js` | Takes a topic → produces outline + SEO metadata (LLM-driven) |
| `blog-draft-generator.js` | Takes a brief → produces draft (LLM-driven, requires human review) |
| `blog-publisher.js` | Takes approved draft → publishes to chosen destination (depends on Option A/B/C) |
| `blog-sitemap-generator.js` | Generates sitemap.xml for SEO |

(All scripts will run in DB-staging mode until publishing destination is chosen.)

---

## 7. Failure Modes / Circuit Breakers

- LLM draft fails (rate limit, error) → fall back to template, log, alert
- SEO score below threshold → block publish, route to human review
- Duplicate slug detected → reject publish, alert
- Publishing fails → mark `status='publish_failed'`, retry next cron

---

## 8. Quality Bar (no AI SEO sludge)

Per mission rules: *"Do NOT mass-produce generic AI-generated SEO sludge. Each article should provide genuine usefulness."*

- Each article must have:
  - Real teacher perspective (not generic AI listicle)
  - At least 1 specific, verifiable claim
  - Original research or data when possible (workflow analysis, rubric examples)
  - Honest about limits (no "revolutionary AI will change everything")
  - Soft CTA (not "BUY NOW")

- SEO score must be ≥ 70 (title, meta, structure, internal links, keyword density)
- Minimum 800 words; target 1,500-2,500

---

## 9. Required Human Decision

1. **Publishing destination** (Option A / B / C above)
2. **Domain strategy** (subdomain vs path)
3. **Frequency target** (suggest 2 articles/week to start)
4. **Whether to publish the existing `launch-blog-01.md`** (yes/no)

---

## 10. Files Created This Phase

- `reports/blog_pipeline.md` (this file)
- `scripts/ops/seed-blog-topics.js`
- DB migration for `blog_topics` table
- (Publication scripts come after human picks destination)

---

## 11. Next Steps

1. Seed 10 topic candidates into DB
2. Generate briefs for the top 3 (most SEO + product-aligned)
3. Human reviews briefs, picks 1 to draft
4. Generate draft, human reviews, picks 1 to publish
5. After publishing destination chosen: publish + add to sitemap

All publication actions remain gated by `status='reviewed'` (human-approved).
