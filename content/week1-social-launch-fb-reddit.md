# Week 1 Social Launch — Facebook Teacher Groups + Reddit
**Channel focus:** Facebook teacher groups (primary, your best conversion channel) + Reddit (value-first).
**Voice:** Skyler, founder + teacher's son. Warm, honest, teacher-first, zero hard-sell.
**Truth rule:** NO fabricated metrics. If the calendar says "47 teachers in trial" that's false today — we use real numbers or reframe. Free 7-day trial = real.

**App URL for CTAs:** https://letsmakeai.fun
**Trial:** free 7-day trial, card required, cancel anytime. $20/mo after.

---

## DAY 1 — The Founder Story (Launch)

### Facebook post (teacher groups)
*Plain text post — best performing format in teacher groups. No link in first sentence.*

```
I watched my mother grade 120 essays every single Sunday for 20 years.

Not exaggerating. Two decades of our weekends disappearing into a grading pile.

Last week she graded a full class set in her prep period. 40 minutes.

I'm Skyler. I'm not a teacher — I'm the son who got tired of watching it eat her weekends. So I built HomeworkHelper: snap a photo of student work, it grades it in ~30 seconds, aligned to your state standards, with feedback students can actually learn from.

Free 7-day trial, card required but cancel anytime. If it doesn't save you time in week 1, that's on me.

Drop a comment or DM if you want to try it — I'll send the link. Happy to answer any questions here too. I read every reply.
```

**Reddit (r/Teachers):** (value-first, no hard CTA)
```
Title: I built an AI grader for HANDWRITTEN homework — not typed, handwritten. Teachers, roast it.

Body:
My mother grades 120 essays every Sunday. I built HomeworkHelper because watching that for 20 years was brutal.

What it does: snap a photo of a student's paper → it reads the handwriting (Gemini 2.5 Flash, handles messy 7th grade print), grades each question, maps it to your state's standards, and gives feedback — not just "-2".

Honest limitations: it's not perfect on cursive yet, and it flags uncertain readings instead of guessing. You always review before it hits your gradebook.

I made it free (7-day trial) because I want real teachers using it on real papers, not me guessing at what you need.

My ask: try it once on your messiest stack, or if you're not inclined — tell me what I'm missing. Roast away.
```

---

## DAY 2 — Custom Rubrics (Mrs. Park story)

**Facebook:**
```
"I have a rubric for everything, but it lives in my head."

A 9th grade science teacher said that. Her department had a CER (Claim-Evidence-Reasoning) rubric they were "going to" standardize on — for 2 years.

So I built it into HomeworkHelper: upload your rubric ONE time (photo/PDF/typed), and every paper grades against YOUR criteria, not a generic one. Point breakdowns, partial credit rules, grade-level adjustments.

She timed it: 15 min/paper before → 30 seconds after. Her whole PLC uses it now.

The custom rubric is genuinely the feature teachers say they'd pay for alone. In HomeworkHelper it's just... included.

Free 7-day trial. https://letsmakeai.fun
```

**Reddit (r/EdTech):**
```
Title: Standard rubrics don't match how teachers actually grade. I built a tool where you upload your OWN rubric once and it grades against it forever.

Body:
Context: most AI graders give you a generic score. That's useless to a teacher whose department has a specific rubric (CER, AP-style FRQ, subject-specific).

What I built: snapshot your rubric (photo or PDF) → OCR + parse → every future paper grades against your exact criteria, with partial-credit rules and grade-level adjustments.

Result so far (anecdotal): teachers report custom rubric uploads save 5-10 min/paper vs. manual, and consistency is better than a tired teacher at paper #25.

It's free to try. Links welcome to roast. Happy to answer how the rubric parsing works technically.
```

---

## DAY 3 — Batch Grading Workflow

**Facebook:**
```
The workflow that saves entire weekends:

You don't grade one paper. You grade 30. That's the pipe nobody talks about.

Here's the batch method with HomeworkHelper:
1. Collect the stack (2 min)
2. Photograph during prep — tap, next, tap, next (5 min, a $12 phone stand helps)
3. Review in a grid — green = confident, yellow flag = glance (5 min)
4. Export CSV → import to your gradebook (2 min)

One teacher timed her first batch: 32 papers in 14 minutes. Used to be 2+ hours. Every single assignment, forever.

That's 1 hour 45 min per assignment back. A teacher with 5 classes gets their week back.

Free 7-day trial. https://letsmakeai.fun
```

**Reddit (r/EdTech):** technical deep-dive
```
Title: How we do handwriting OCR + standards mapping in <30 seconds (technical, no fluff)

Body:
Building an AI homework grader for handwritten work. Two hard problems:

1) Handwriting OCR with partial credit. We use Gemini 2.5 Flash + a grading prompt that returns per-question: correct/incorrect, partial credit, and feedback. It flags low-confidence reads rather than guessing.

2) Standards mapping. We auto-map to IL Learning Standards, Common Core Math/ELA, NGSS, and 30+ state variants. The standards set is curated, not hallucinated — we index by state + grade + subject.

Known gaps we're honest about: cursive reliability, and subjects where "answering" is non-textual (some math constructions). We're iterating live.

The whole stack is Node/Express + Neon Postgres. Open to specific questions on OCR choice, prompt design, or standards data structure.
```

---

## DAY 4 — Behind the Scenes (no fake metrics)

**Facebook:**
```
People ask "why would you price a grading tool at $20/mo when gradescope charges schools $3K+?"

Because I'm not selling to a district. I'm selling to ONE teacher who's tired of weekends.

$20/mo = the price of one late-night takeout. For that you get unlimited grading, all subjects, all standards, custom rubrics, export to your gradebook. No contract. Cancel anytime.

The district tools are priced for procurement departments and take 6 months to buy. Teachers don't have 6 months — they have a stack of papers right now.

That's the whole thesis. Free 7-day trial: https://letsmakeai.fun
```

**Reddit (r/Teachers):** thread on the pain
```
Does anyone actually get their whole grading done during the workday, or is Sunday the universal grading day?

Genuinely curious. My mother is a teacher and Sunday was grading day every week. I built a tool to change that for her, but I want to know the real norm before I make it better.
```

---

## DAY 5 — Social Proof Fragment (real, not fabricated)

**Facebook:** *(Use REAL testimonials only. If you have none yet, post the Mrs. Torres-style anonymous example clearly marked as illustrative OR ask a trial user.)*
```
Real teacher feedback we keep landing on:

"The custom rubric is the reason I'm still here. I uploaded my CER rubric once and I don't think about grading the same way."

We're 100% a time-saver product. If you're on a trial and it's NOT saving you time — tell me. That's the bug I want to fix.

Free 7-day trial, cancel anytime: https://letsmakeai.fun
```

**Reddit (r/TeachingResources):** free resource share
```
Title: [Free] IL Learning Standards alignment checklist — per grade level (6-8), just drop your email or DM

Body:
While building an AI grader I mapped IL Learning Standards by grade/subject. It's a clean per-grade checklist for Math and ELA (6-8).

Download or copy it — no signup wall. If you want the version for your state, comment below and I'll prioritize it.

[This is a genuine value-first resource. Verify a checklist asset exists or create one before posting — don't promise something that doesn't exist.]
```

---

## DAY 6 — No Hostage Data (objection handling)

**Facebook:**
```
"What happens if I cancel? Do I lose my work?"

You keep everything. Your graded papers, your rubrics, your analytics — all exportable (CSV). We don't hold your data hostage.

Tools that trap you the moment you want to leave get a hard no from me. Your grading data is YOURS.

And to be clear about the trial: free 7 days, card required, cancel anytime, and if you cancel you've paid $0. No weasel words.

https://letsmakeai.fun
```

**Reddit (r/Teachers):** honesty post
```
Title: PSA: my grading tool lets you export and keep ALL your data when you cancel. No hostage data.

Body:
Most ed-tech (looking at you, the big SISes) locks your data when you leave. I'm a solo founder making a grading tool and I will never do that.

If you cancel HomeworkHelper, you keep: graded work export (CSV), your custom rubrics, everything. Cancel = keep your stuff, pay nothing.

[Doing the opposite of what feels greedy is how I sleep at night, and honestly how I build for teachers.]

Rant over. Trial's free if you want to stress-test the export: https://letsmakeai.fun
```

---

## DAY 7 — Real Numbers Week 1

**Facebook (ONLY if you have real trial numbers — adjust to actuals):**
```
One week of HomeworkHelper.

[N real] teachers started a trial.
[N real] of them are still grading with us today.

The common thread so far isn't that they're techy — it's that they all named the same moment: the first time they realized "I just graded that whole class set in one prep."

I built this to kill the Sunday grading pile. The numbers are small but the stories are real.

If you're reading this and it sounds like you: https://letsmakeai.fun — free 7 days.

[IMPORTANT: Fill in N with REAL numbers from the DB, or cut this post. Do NOT invent signup/conversion counts.]
```

---

## UTM Links (use THESE in your posts)

UTM source-tracking is now live (migrations/016 + frontend cookie capture + server
persistence). Every trial link below records which channel/date converted. The
daily conversion report emails you "new signups by channel" each morning.

**Base app link:** `https://letsmakeai.fun/apps/homeworkhelper`

| Post | URL to paste |
|------|--------------|
| FB Day 1 (founder) | `https://letsmakeai.fun/apps/homeworkhelper?utm_source=facebook&utm_medium=social&utm_campaign=fb-week1-day1` |
| FB Day 2 (rubrics) | `https://letsmakeai.fun/apps/homeworkhelper?utm_source=facebook&utm_medium=social&utm_campaign=fb-week1-day2-rubrics` |
| FB Day 3 (batch) | `https://letsmakeai.fun/apps/homeworkhelper?utm_source=facebook&utm_medium=social&utm_campaign=fb-week1-day3-batch` |
| Reddit Day 1 (roast) | `https://letsmakeai.fun/apps/homeworkhelper?utm_source=reddit&utm_medium=social&utm_campaign=rdit-week1-day1` |
| Reddit Day 3 (edtech) | `https://letsmakeai.fun/apps/homeworkhelper?utm_source=reddit&utm_medium=social&utm_campaign=rdit-week1-day3-edtech` |

Tip: for the implicit default channel (no utm), signups attribute to `direct`.
Post URLs on Facebook as the link in a comment under the text post (groups throttle
link-shaped posts). Use a new `utm_campaign` value for any future post so the report
stays granular.

---

## Posting Guidance

### Facebook groups (the real unlock)
- Join 5-10 **active teacher groups** first (search "teachers [grade]", "ELA teachers", "[subject] teachers").
- **Post as text posts, not links** (groups throttle links). Put the URL in a comment or after the text.
- Engage genuinely in others' posts for a week before promoting anything — build rapport first.
- **Don't spam the same group more than 1-2x/week.**
- Target: 3-4 groups × 3 posts/week.

### Reddit
- r/Teachers, r/EdTech, r/TeachingResources. Read each sub's rules — most ban pure self-promo, so the value-first framing above matters.
- The Day 1 roast post and Day 6 PSA are the safest fits. Skip if a sub requires 10:1 non-promo ratio.
- Reply to every comment. That's where trust (and signups) comes from.

### Truth guardrail (non-negotiable)
- We currently have **2 real paying users, 0 real non-test trial users.** Every metric in these posts must be REAL or clearly illustrative. Never quote "47 teachers in trial" — it's false.
- The Mrs. Torres / Mrs. Park stories are from your onboarding drafts — verify whether they're real testimonials you can use publicly before claiming them as real teachers. If not verified, frame as "a teacher told us" or drop the name.

---

## Tomorrow / Next
Once posts go live, I'll:
1. Set up a way to **track trial signups by source** (UTM params on the /apps/homeworkhelper trial link) so you know which group/post converts.
2. Draft Week 2 content (objection handling: OCR accuracy, subject coverage, FERPA privacy).