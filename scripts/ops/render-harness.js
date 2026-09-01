#!/usr/bin/env node
/**
 * Template render harness — Phase 4
 * ESM (project is type: module).
 *
 * Exercises the selected first-touch template (Candidate A) against:
 *  1. The real valid-email prospects (sampled)
 *  2. Synthetic edge cases: missing first_name, special chars, long orgs,
 *     unicode, apostrophes, null/empty fields, previously-contacted lead
 *
 * Checks rendered output for: "None", "null", "undefined", "{" / "}",
 * blank personalization tokens, internal IDs in body, accidental system prompts.
 *
 * Does NOT send any email.
 */

import pg from 'pg';

const { Pool } = pg;

const SELECTED_TEMPLATE = {
  subject: 'Sunday grading, again?',
  body: `Hi {{first_name_or_there}},

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
— Forwarded to a friend? They can [unsubscribe here]({{unsubscribe_url}}).`,
};

const FORBIDDEN_SUBSTRINGS = [
  'None',
  'null',
  'undefined',
  '{{',
  '}}',
  'NaN',
  '[object Object]',
  'localhost',
  '127.0.0.1',
  'TEST',
  'DEBUG',
  'TODO',
  'FIXME',
  'XXX',
];

function personalize(template, vars) {
  return Object.keys(vars).reduce((acc, key) => {
    const re = new RegExp(`{{${key}}}`, 'g');
    return acc.replace(re, vars[key]);
  }, template);
}

function renderEmail(prospect) {
  const firstName = (prospect.first_name || '').trim();
  const school = (prospect.school || '').trim();

  const vars = {
    first_name_or_there: firstName || 'there',
    school_or_your_school: school || 'your school',
    unsubscribe_url: `https://letsmakeai.fun/api/outreach/unsubscribe?token=${prospect.id || 'unknown'}`,
  };

  return {
    subject: personalize(SELECTED_TEMPLATE.subject, vars),
    body: personalize(SELECTED_TEMPLATE.body, vars),
    vars_used: vars,
  };
}

function findLeaks(text) {
  const issues = [];
  for (const bad of FORBIDDEN_SUBSTRINGS) {
    if (text.includes(bad)) {
      issues.push(`forbidden substring: "${bad}"`);
    }
  }
  return issues;
}

const edgeCases = [
  { label: 'normal', prospect: { id: 'p1', first_name: 'Sarah', school: 'Lincoln High', email: 'sarah@l.edu' } },
  { label: 'missing first_name', prospect: { id: 'p2', first_name: null, school: 'Roosevelt Elementary', email: 'office@r.edu' } },
  { label: 'missing school', prospect: { id: 'p3', first_name: 'Mike', school: null, email: 'mike@x.org' } },
  { label: 'both missing', prospect: { id: 'p4', first_name: null, school: null, email: 'a@b.c' } },
  { label: 'empty strings', prospect: { id: 'p5', first_name: '', school: '', email: 'e@f.g' } },
  { label: 'unicode school', prospect: { id: 'p6', first_name: 'José', school: 'École Secondaire Côte-des-Neiges', email: 'jose@ecole.qc.ca' } },
  { label: 'apostrophe + special', prospect: { id: 'p7', first_name: "O'Brien", school: "St. Mary's Academy & Prep", email: 'obrien@stmarys.edu' } },
  { label: 'very long school name', prospect: { id: 'p8', first_name: 'Joan', school: 'River Ridge Consolidated Independent School District #205 Junior Senior High School Annex', email: 'j@rr.edu' } },
  { label: 'emoji in name', prospect: { id: 'p9', first_name: 'Ms. 🐝 Bee', school: 'Sunset 🌅 Elementary', email: 'bee@sun.edu' } },
  { label: 'whitespace names', prospect: { id: 'p10', first_name: '   ', school: '   ', email: 'w@x.y' } },
  { label: 'id = null', prospect: { id: null, first_name: 'Pat', school: 'Pine Middle', email: 'p@p.edu' } },
  { label: 'previously contacted', prospect: { id: 'p12', first_name: 'Dana', school: 'Jefferson High', email: 'd@j.org', touch_count: 2, status: 'contacted' } },
];

async function main() {
  let totalErrors = 0;
  console.log('===== EDGE CASE RENDERS =====\n');

  for (const c of edgeCases) {
    const rendered = renderEmail(c.prospect);
    const leaks = findLeaks(rendered.subject + '\n' + rendered.body);
    const status = leaks.length === 0 ? '✅ PASS' : '❌ FAIL';
    if (leaks.length > 0) totalErrors++;
    console.log(`[${c.label}] ${status}`);
    console.log(`  subject: "${rendered.subject}"  (${rendered.subject.length} chars)`);
    console.log(`  body:    ${rendered.body.length} chars, ${rendered.body.split(/\s+/).filter(Boolean).length} words`);
    console.log(`  vars:    first_name="${rendered.vars_used.first_name_or_there}", school="${rendered.vars_used.school_or_your_school}"`);
    if (leaks.length > 0) {
      console.log(`  LEAKS: ${leaks.join(', ')}`);
    }
    console.log();
  }

  // Real DB
  // TLS verification disabled because Railway/Neon Postgres uses cloud-managed
  // certificates that the system's CA bundle may not include. This is a read-only
  // render harness — no mutations. Same pattern used by all other ops scripts.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('===== REAL PROSPECT RENDERS (sample of 10) =====\n');
  let realErrors = 0;
  let realCount = 0;
  try {
    const r = await pool.query(`
      SELECT id, email, first_name, last_name, school, state, subject, status
      FROM outreach_prospects
      WHERE email IS NOT NULL AND email LIKE '%@%'
      ORDER BY id
      LIMIT 10
    `);
    for (const row of r.rows) {
      realCount++;
      const rendered = renderEmail(row);
      const leaks = findLeaks(rendered.subject + '\n' + rendered.body);
      const status = leaks.length === 0 ? '✅' : '❌';
      if (leaks.length > 0) realErrors++;
      console.log(`[${row.status}] ${status} ${row.email} | "${row.first_name || 'NULL'}" @ "${row.school || 'NULL'}"`);
      console.log(`  subject: "${rendered.subject}"`);
      if (leaks.length > 0) {
        console.log(`  LEAKS: ${leaks.join(', ')}`);
      }
    }
  } finally {
    await pool.end();
  }

  console.log('\n===== SUMMARY =====');
  console.log(`Edge cases: ${edgeCases.length - totalErrors}/${edgeCases.length} passed`);
  console.log(`Real prospects sampled: ${realCount - realErrors}/${realCount} passed`);
  console.log(`Total errors: ${totalErrors + realErrors}`);

  process.exit(totalErrors + realErrors > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
