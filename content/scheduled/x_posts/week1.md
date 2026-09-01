# X/Twitter Week 1 Content Drafts — HomeworkHelper

**Date:** 2026-09-01
**Status:** DRAFT — awaiting human approval before going to `status='approved'` in DB

---

## Daily Schedule (Mon-Fri, 9 AM CDT)

### Day 1 (Mon) — Founder Story
**Category:** founder_story
**Type:** Single post (with optional thread)

> I watched my wife grade 120 essays every Sunday for 8 years.
>
> Last week, she graded 30 of them in 4 minutes.
>
> No magic — just a photo, a rubric, and an AI that doesn't get tired.
>
> Here's what I learned building it for her (and every teacher who's lost a weekend to grading):

---

### Day 1 Bonus — Engagement Question
**Category:** engagement

> Teachers: what's the Sunday task that eats the most hours?
>
> (Grading mine was the obvious one — but I'm collecting data. Replies help us build the right features.)

---

### Day 2 (Tue) — Pain Point
**Category:** teacher_pain_points

> The arithmetic is right or wrong.
>
> The definitions are correct or they aren't.
>
> The citations are missing or they aren't.
>
> 70% of grading is bookkeeping a machine can do in 30 seconds.
>
> The other 30% is the part only you can do. Keep that. Let go of the rest.

---

### Day 3 (Wed) — Behind-the-Scenes
**Category:** behind_the_scenes

> Why we charge $20/mo for HomeworkHelper:
>
> – Costs us ~$2/mo in AI + infra per active teacher
> – Stripe takes ~$1
> – Leaves ~$17 to keep building, supporting, and not selling data
>
> Free tools either sell your data, get acquired, or die. We want to be around in 5 years.

---

### Day 4 (Thu) — Product Tip
**Category:** product_tip

> The custom-rubric feature is the one teachers tell me they'd pay for alone.
>
> Snap your department's rubric once → every paper grades against it forever.
>
> No more writing the same feedback 25 times per class.

---

### Day 4 Bonus — Use Case
**Category:** product_tip

> Real workflow from a beta teacher:
>
> 1. Friday: collects 30 essays, photos batch
> 2. AI grades + writes feedback (4 min)
> 3. Teacher reviews, adjusts 5 grades, approves rest (12 min)
> 4. Export CSV → gradebook
>
> Total time: 16 minutes for 30 essays. She used to spend 3 hours.

---

### Day 5 (Fri) — Customer Win
**Category:** customer_win

> First email I got from a real teacher using HomeworkHelper:
>
> "I finished grading before dinner. My husband asked if I was sick."
>
> That's the whole product.

---

## Hashtag Set (rotating)

- `#TeacherLife`
- `#EdTech`
- `#GradingHacks`
- `#AIforGood`
- `#TeacherTwitter`
- `#K12`
- `#AITeachers`

Use 2-3 max per post.

---

## Approval Status

To approve these drafts, an authorized human reviewer should run:

```sql
UPDATE scheduled_content
SET status = 'approved',
    meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{approval_status}', '"human_approved"')
WHERE content_type IN ('twitter_post', 'twitter_thread')
  AND status = 'draft';
```

Or use the human-review command if/when one is added to the API.

---

## Voice Notes

- **First-person, conversational.** Not "we believe" — "I watched."
- **No hype.** No "revolutionary," "game-changing," "AI-powered." Show, don't claim.
- **Concrete numbers.** 30 essays, 4 minutes, $2/mo. Specifics beat superlatives.
- **Honest about being small.** "Beta teacher," "first email I got" — vulnerability builds trust.
- **CTAs are soft.** No "BUY NOW." Try HomeworkHelper free / photo a stack / finish before dinner.

---

## Next Steps

1. User reviews each draft
2. Approves via the SQL above
3. Publishes go out Mon-Fri 9 AM via `x-post-pipeline.js` cron
4. Engagement tracked via `x-engagement-tracker.js` cron
