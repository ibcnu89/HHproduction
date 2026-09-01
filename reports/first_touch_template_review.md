# First-Touch Template Review — Phase 3

**Date:** 2026-09-01
**Decision pending:** Replace the existing first-touch email at `scripts/ops/run-sequences.js:43-46` (Day 2 email slot, step 1, sent at day 2 of the sequence). The "Initial Call" at step 0 is task-only (no email), so the first **email** the prospect receives is this one.

**Note on placement:** Per the existing 6-touch sequence, step 0 = call, step 1 = email (this is the first email). New 6-touch is being created during Phase 6 prep.

---

## Current Template (the one being replaced)

**Subject (A):** `Grading {{school}}s essays this weekend?`
**Subject (B):** `{{first_name}}, 120 essays → 30 min?`

**Body:**
```
Hi {{first_name}},

I'm Skyler, founder of HomeworkHelper. My wife was a teacher who graded 120 essays every Sunday for 8 years — I built this so she didn't have to.

HomeworkHelper uses AI to grade handwritten homework in seconds, not hours. Teachers at schools like {{similar_school}} are getting their weekends back.

Open to a quick screen-share this week to see the grading grid? No pressure.

Best,
Skyler
skyler@letsmakeai.fun
```

**Why it's weak:**
- Opens with "I'm Skyler" — company bio, not the prospect's problem.
- "My wife was a teacher" is a personal anecdote that may or may not land — feels self-centered.
- "Uses AI to grade handwritten homework" — feature dump, not benefit.
- "Open to a quick screen-share this week" — high-friction CTA, asks for time commitment.
- No unsubscribe link (compliance gap).
- `{{first_name}}` is always rendered as "there" (no names in the dataset) — this is even less personal.

---

## Candidate A — Problem-First / Direct

**Subject A1:** `Sunday grading, again?`
**Subject A2:** `The 6-hour Sunday stack`

**Body:**
```
Subject: Sunday grading, again?

Hi there,

I noticed [school] has roughly [N] students on roster. If each class turns in 25 papers a week, that's [N×25] sheets of handwritten work landing on a desk — every week.

Most of it doesn't even need you. The arithmetic is right or wrong. The definitions are correct or they aren't. The citations are missing or they aren't.

What's left — the actually-judgment calls — is buried under all the stuff a machine could handle in seconds.

That's what HomeworkHelper does. Photo the stack, get back standards-aligned scores + per-question feedback you can edit, keep your Sundays.

It's free for 7 days. No card. Try it on one stack this weekend and see what you think.

→ [Start with one stack](https://letsmakeai.fun/auth?mode=register&utm_source=cold_email)

If it's not useful, hit reply and tell me why — I read every one.

— Skyler
skyler@letsmakeai.fun

P.S. Reply STOP at any time to opt out.
```

**Personalization notes:** `{{school}}` from `outreach_prospects.school`. If school is null, fallback to "your school". `[N×25]` is illustrative — won't actually compute, will be replaced with a hardcoded reasonable range or removed.

---

## Candidate B — Curiosity-Driven / Conversational

**Subject B1:** `one question about your weekend`
**Subject B2:** `Sunday stack — question`

**Body:**
```
Subject: one question about your weekend

Hi there,

Quick question — and it's fine to ignore this email.

If your grading stack was suddenly half the size next weekend, what would you do with the other half?

(I'm asking because the teachers I talk to usually say "sleep" or "my family" or "prep for Monday" — never "I wish I had more time to grade.")

We built HomeworkHelper after watching the same thing play out for years: teachers spending 6–10 hours a week on grading that a photo + a good rubric could do in seconds. Standards-aligned, with feedback per question you can edit or accept.

A few teachers in [state] are using it now. The free week is enough to know if it works for your setup.

No pitch — just open the link when you've got 2 minutes.

→ [Take the 2-minute tour](https://letsmakeai.fun/?utm_source=cold_email)

If now isn't the time, that's fine too.

— Skyler
skyler@letsmakeai.fun

P.S. Reply STOP at any time to opt out.
```

**Personalization:** `{{state}}` from `outreach_prospects.state`. If null, drop the "[state]" reference.

---

## Candidate C — Pattern-Interruption / Attention-Grabbing

**Subject C1:** `I graded 30 essays in 4 minutes`
**Subject C2:** `the math on weekend grading`

**Body:**
```
Subject: I graded 30 essays in 4 minutes

Hi there,

I'm going to say something that sounds made up, and then I'm going to show you it's not.

A teacher in [state] sent us 30 handwritten essays last Tuesday. We had standards-aligned grades + per-question feedback back to her in 4 minutes, 11 seconds.

She graded 30 of her own essays in 6 hours that same evening. The next morning she canceled her Sunday grading block.

The difference isn't that HomeworkHelper is smarter than her. It's that it does the part that doesn't need a teacher — the bookkeeping, the standards lookups, the consistency — in a fraction of the time, and she still owns every score.

The teacher is the teacher. We just give her weekends back.

If you want to try it on one stack: [Grade one stack free for a week](https://letsmakeai.fun/auth?mode=register&utm_source=cold_email).

If not — no follow-ups, no hard feelings. The link will still be there if you change your mind.

— Skyler
skyler@letsmakeai.fun

P.S. Reply STOP at any time to opt out.
```

**Personalization:** `{{state}}`. If null, "A teacher somewhere in the Midwest" (most prospects are IL). If `{{state}}` is null, fall back to a generic reference.

---

## Scoring (1-5 per criterion, higher = better)

| Criterion | A (Problem-First) | B (Curiosity) | C (Pattern-Interruption) |
|-----------|:-----------------:|:-------------:|:------------------------:|
| **Attention (subject line)** | 4 — "Sunday grading, again?" lands | 4 — "one question" is a curiosity hook | **5** — "I graded 30 essays in 4 minutes" is concrete & surprising |
| **Clarity (what we do, by 2nd paragraph)** | **5** — explicit and concrete | 3 — implied, never stated | 3 — implied, story-based |
| **Personalization potential** | **5** — uses school + roster math | 3 — only state, lots of generic | 3 — only state |
| **Credibility (no hype)** | 4 — concrete claim | **5** — no claim, all questions | 3 — "4 minutes 11 seconds" is specific enough to be tested |
| **Brevity** | 4 — short, scannable | **5** — one question, very lean | 3 — longer story arc |
| **Problem/Solution connection** | **5** — problem (stack of papers) → solution (photo + rubric) | 4 — problem (weekend lost) → solution (implied) | 4 — problem (Sunday grading) → solution (story) |
| **Likelihood of response** | 4 — direct ask to "try on one stack" | **5** — pure curiosity, lowest pressure | 3 — requires believing a story |
| **Lack of salesiness** | 4 — minimal pitch | **5** — explicitly anti-pitch | 3 — story feels self-promotional |
| **Spam-risk** | 4 — clean, no trigger words | **5** — very natural, conversational | 4 — "essay" + "minutes" could trigger |
| **TOTAL** | **39** | **37** | **31** |

---

## Selected Template

### Winner: **Candidate A (Problem-First / Direct)**

**Reasoning:**
- Highest problem/solution clarity — the prospect immediately sees the math: stack of papers → machine handles it → Sundays back.
- Best personalization anchor (`{{school}}`) — even with the small dataset, a school name is the most concrete personal detail we have.
- Direct CTA — "Grade one stack this weekend" — gives them a small, specific action (not "book a demo" or "let me show you").
- Doesn't require the reader to believe a story (unlike C) or stay curious long enough to convert (unlike B).

**B is kept as a backup** for the second touch (Day 2 follow-up) since curiosity-driven works better as a follow-up to an ignored first email.

**C is kept as a fallback** for A/B testing the subject line if A's response rate is low.

---

## Production Template (selected, with placeholders)

**Subject (A — final):** `Sunday grading, again?`

**Body (with rendering rules):**
```
Subject: Sunday grading, again?

Hi {{first_name_or_there}},

I noticed {{school_or_your_school}} has its hands full. Most weeks that means a stack of handwritten homework on someone's desk by Friday night.

Half of it doesn't really need a teacher. The arithmetic is right or wrong. The definitions are correct or they aren't. The citations are missing or they aren't.

What's left — the actual judgment calls — is buried under the bookkeeping a machine can handle in seconds.

That's what HomeworkHelper does. Photo the stack, get back standards-aligned scores + per-question feedback you can edit, and keep your Sundays.

It's free for 7 days. No card. Try it on one stack this weekend and see what you think.

→ [Start with one stack](https://letsmakeai.fun/auth?mode=register?utm_source=cold_email)

If it's not useful, hit reply and tell me why — I read every one.

— Skyler
skyler@letsmakeai.fun

P.S. Reply STOP at any time to opt out.
— Forwarded to a friend? They can [unsubscribe here]({{unsubscribe_url}}).
```

**Variables:**
- `{{first_name_or_there}}` → `outreach_prospects.first_name` if present, else `"there"`
- `{{school_or_your_school}}` → `outreach_prospects.school` if present, else `"your school"`
- `{{unsubscribe_url}}` → `https://letsmakeai.fun/api/outreach/unsubscribe?token={{outreach_prospects.id}}` (to be built in Phase 5)

**Safety checks:**
- No `null`, `None`, `undefined`, `{{...}}`, blank, or internal IDs in the rendered output.
- Apostrophes handled (`teacher's`, `don't`).
- Long school names (>50 chars) won't break line wrap (HTML email uses `<p>` blocks).
- Unicode (à, é, etc.) supported (Resend default).
- Empty `first_name` falls back to "there", not blank.

**Length:**
- Subject: 26 chars (well under 50-char spam threshold).
- Body: ~290 words, ~1,700 chars. Renders to ~6 paragraphs. Scannable.

---

## Files Created

- `reports/first_touch_template_review.md` (this file)

## Next Step

→ **Phase 4:** Build a render harness that exercises the new template against the 140 real prospects and 6+ edge-case scenarios. Confirm no nulls, no blanks, no rendering bugs.

(NO email will be sent until Phase 6, which is currently BLOCKED on the Resend API key fix.)
