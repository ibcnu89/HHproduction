#!/usr/bin/env node
/**
 * Seed X/Twitter Week 1 drafts into scheduled_content.
 * Status = 'draft'. approval_status = 'pending_review'.
 * NEVER auto-approves. Human must approve before any publish.
 */

import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DRAFTS = [
  {
    title: 'Founder Story — Wife grading essays',
    text: `I watched my wife grade 120 essays every Sunday for 8 years.

Last week, she graded 30 of them in 4 minutes.

No magic — just a photo, a rubric, and an AI that doesn't get tired.

Here's what I learned building it for her (and every teacher who's lost a weekend to grading):`,
    meta: {
      category: 'founder_story',
      cta: '',
      source_reference: 'social-calendar-30day.md#week1-day1',
      approval_status: 'pending_review',
      pillar: 'founder_story',
    },
    publish_at: '2026-09-08 09:00:00-05:00',
  },
  {
    title: 'Engagement Q — Sunday tasks',
    text: `Teachers: what's the Sunday task that eats the most hours?

(Grading mine was the obvious one — but I'm collecting data. Replies help us build the right features.)`,
    meta: {
      category: 'engagement',
      cta: '',
      source_reference: 'social-calendar-30day.md#week1-day1-bonus',
      approval_status: 'pending_review',
      pillar: 'engagement',
    },
    publish_at: '2026-09-08 13:00:00-05:00',
  },
  {
    title: 'Pain Point — 70% bookkeeping',
    text: `The arithmetic is right or wrong.

The definitions are correct or they aren't.

The citations are missing or they aren't.

70% of grading is bookkeeping a machine can do in 30 seconds.

The other 30% is the part only you can do. Keep that. Let go of the rest.`,
    meta: {
      category: 'teacher_pain_points',
      cta: '',
      source_reference: 'social-calendar-30day.md#week1-day2',
      approval_status: 'pending_review',
      pillar: 'teacher_pain_points',
    },
    publish_at: '2026-09-09 09:00:00-05:00',
  },
  {
    title: 'BTS — Why $20/mo',
    text: `Why we charge $20/mo for HomeworkHelper:

– Costs us ~$2/mo in AI + infra per active teacher
– Stripe takes ~$1
– Leaves ~$17 to keep building, supporting, and not selling data

Free tools either sell your data, get acquired, or die. We want to be around in 5 years.`,
    meta: {
      category: 'behind_the_scenes',
      cta: '',
      source_reference: 'social-calendar-30day.md#week1-day3',
      approval_status: 'pending_review',
      pillar: 'behind_the_scenes',
    },
    publish_at: '2026-09-10 09:00:00-05:00',
  },
  {
    title: 'Product Tip — Custom Rubric',
    text: `The custom-rubric feature is the one teachers tell me they'd pay for alone.

Snap your department's rubric once → every paper grades against it forever.

No more writing the same feedback 25 times per class.`,
    meta: {
      category: 'product_tip',
      cta: 'Try HomeworkHelper free → letsmakeai.fun',
      source_reference: 'social-calendar-30day.md#week1-day4',
      approval_status: 'pending_review',
      pillar: 'product_tip',
    },
    publish_at: '2026-09-11 09:00:00-05:00',
  },
  {
    title: 'Use Case — Friday workflow',
    text: `Real workflow from a beta teacher:

1. Friday: collects 30 essays, photos batch
2. AI grades + writes feedback (4 min)
3. Teacher reviews, adjusts 5 grades, approves rest (12 min)
4. Export CSV → gradebook

Total time: 16 minutes for 30 essays. She used to spend 3 hours.`,
    meta: {
      category: 'product_tip',
      cta: 'letsmakeai.fun',
      source_reference: 'social-calendar-30day.md#week1-day4-bonus',
      approval_status: 'pending_review',
      pillar: 'product_tip',
    },
    publish_at: '2026-09-11 13:00:00-05:00',
  },
  {
    title: 'Customer Win — Finished before dinner',
    text: `First email I got from a real teacher using HomeworkHelper:

"I finished grading before dinner. My husband asked if I was sick."

That's the whole product.`,
    meta: {
      category: 'customer_win',
      cta: '',
      source_reference: 'social-calendar-30day.md#week1-day5',
      approval_status: 'pending_review',
      pillar: 'customer_win',
    },
    publish_at: '2026-09-12 09:00:00-05:00',
  },
];

async function main() {
  console.log('Seeding X/Twitter Week 1 drafts...\n');

  // Check existing
  const existing = await pool.query(`
    SELECT count(*)::int as n FROM scheduled_content
    WHERE content_type IN ('twitter_post', 'twitter_thread')
  `);
  if (existing.rows[0].n > 0) {
    console.log(`Found ${existing.rows[0].n} existing X posts in DB.`);
    console.log('Skipping seed. To re-seed, manually delete existing rows first.');
    await pool.end();
    return;
  }

  let inserted = 0;
  for (const d of DRAFTS) {
    await pool.query(`
      INSERT INTO scheduled_content (
        title, content_type, text, platforms, status, publish_at, meta
      ) VALUES ($1, 'twitter_post', $2, '["twitter"]'::jsonb, 'draft', $3, $4)
    `, [d.title, d.text, d.publish_at, JSON.stringify(d.meta)]);
    inserted++;
    console.log(`  ✅ ${d.title} (publish_at=${d.publish_at})`);
  }

  console.log(`\nInserted ${inserted} drafts.`);
  console.log('Status: draft. approval_status: pending_review.');
  console.log('NO PUBLISHING will occur until a human approves each one.');
  await pool.end();
}

main().catch(async e => {
  console.error('Seed failed:', e);
  await pool.end().catch(() => {});
  process.exit(1);
});
