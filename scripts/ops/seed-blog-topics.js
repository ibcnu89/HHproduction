#!/usr/bin/env node
/**
 * Blog Topic Seeder — Phase 9
 * Seeds 10 initial blog topic candidates into blog_topics table.
 * All start in status='idea'. Brief generation comes next.
 */

import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const TOPICS = [
  {
    slug: 'how-to-grade-faster-without-losing-quality',
    title: 'How to grade faster without losing quality',
    target_keyword: 'how to grade faster',
    search_intent: 'informational',
    pillar: 'teacher_productivity',
  },
  {
    slug: 'ai-grading-for-teachers-what-works-and-what-doesnt',
    title: "AI grading for teachers: what works and what doesn't",
    target_keyword: 'ai grading for teachers',
    search_intent: 'commercial',
    pillar: 'edtech',
  },
  {
    slug: 'how-to-write-a-rubric-that-saves-grading-time',
    title: 'How to write a rubric that saves grading time',
    target_keyword: 'rubric writing for teachers',
    search_intent: 'informational',
    pillar: 'grading',
  },
  {
    slug: 'the-sunday-grading-problem',
    title: "The Sunday grading problem: why it exists and what to do about it",
    target_keyword: 'sunday grading teacher',
    search_intent: 'informational',
    pillar: 'teacher_productivity',
  },
  {
    slug: 'photo-grading-teachers-guide',
    title: "Photo grading: a teacher's guide to using your phone for grading",
    target_keyword: 'photo grading app teacher',
    search_intent: 'commercial',
    pillar: 'product',
  },
  {
    slug: 'common-core-standards-cheat-sheet',
    title: 'Common Core standards cheat sheet (K-12 by grade)',
    target_keyword: 'common core standards',
    search_intent: 'informational',
    pillar: 'standards',
  },
  {
    slug: 'state-standards-alignment-50-states',
    title: 'State standards alignment: how to find and use your state standards',
    target_keyword: 'state standards',
    search_intent: 'informational',
    pillar: 'standards',
  },
  {
    slug: 'handwritten-homework-ocr-accuracy',
    title: 'Handwritten homework OCR: how accurate is it really?',
    target_keyword: 'handwritten homework ocr',
    search_intent: 'informational',
    pillar: 'edtech',
  },
  {
    slug: 'free-rubric-templates-k12-teachers',
    title: 'Free rubric templates for K-12 teachers (by subject)',
    target_keyword: 'free rubric template',
    search_intent: 'transactional',
    pillar: 'grading',
  },
  {
    slug: 'batch-grading-50-papers-15-minutes',
    title: 'How one teacher grades 50 papers in 15 minutes',
    target_keyword: 'batch grading teacher',
    search_intent: 'informational',
    pillar: 'product',
  },
];

async function main() {
  console.log('Seeding blog topic candidates...\n');

  // Create table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_topics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug VARCHAR(255) UNIQUE NOT NULL,
      title TEXT NOT NULL,
      target_keyword TEXT,
      search_intent VARCHAR(50),
      pillar VARCHAR(50),
      outline JSONB,
      meta_title VARCHAR(255),
      meta_description TEXT,
      internal_links JSONB DEFAULT '[]',
      cta JSONB,
      status VARCHAR(20) DEFAULT 'idea',
      body_md TEXT,
      body_html TEXT,
      author VARCHAR(100) DEFAULT 'Skyler @ HomeworkHelper',
      published_at TIMESTAMPTZ,
      url TEXT,
      seo_score INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  let inserted = 0, skipped = 0;
  for (const t of TOPICS) {
    try {
      await pool.query(`
        INSERT INTO blog_topics (slug, title, target_keyword, search_intent, pillar)
        VALUES ($1, $2, $3, $4, $5)
      `, [t.slug, t.title, t.target_keyword, t.search_intent, t.pillar]);
      inserted++;
      console.log(`  ✅ ${t.slug}`);
    } catch (e) {
      if (e.code === '23505') { // unique violation
        skipped++;
        console.log(`  ⏭  ${t.slug} (already exists)`);
      } else {
        throw e;
      }
    }
  }

  console.log(`\nInserted ${inserted}, skipped ${skipped}.`);
  console.log('All topics are in status=idea. Brief generation (Phase 11) will move them to outlined.');
  await pool.end();
}

main().catch(async e => {
  console.error('Seed failed:', e);
  await pool.end().catch(() => {});
  process.exit(1);
});
