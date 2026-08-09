/**
 * Firecrawl-based scraper for non-Common Core state standards
 * Uses the firecrawl_search and firecrawl_scrape tools to find and extract standards
 */

import { STATES } from './state-config.js';
// Non-Common Core states (9) - need state-specific standards
const NON_COMMON_CORE = STATES.filter(s => s.type === 'nonCommonCore');

console.log('Non-Common Core states to scrape:');
NON_COMMON_CORE.forEach(s => {
  console.log(`  ${s.code} - ${s.name} (${s.framework})`);
  console.log(`    URL: ${s.doeUrl}`);
});

/**
 * Search queries for finding standards pages
 */
const SEARCH_QUERIES = {
  TX: [
    'Texas TEKS standards Mathematics grade 5 site:tea.texas.gov',
    'Texas TEKS standards English Language Arts grade 5 site:tea.texas.gov',
    'Texas Essential Knowledge and Skills Science grade 5 site:tea.texas.gov',
    'Texas Essential Knowledge and Skills Social Studies grade 5 site:tea.texas.gov'
  ],
  VA: [
    'Virginia SOL standards Mathematics grade 5 site:doe.virginia.gov',
    'Virginia SOL standards English grade 5 site:doe.virginia.gov',
    'Virginia Standards of Learning Science grade 5 site:doe.virginia.gov',
    'Virginia Standards of Learning History grade 5 site:doe.virginia.gov'
  ],
  FL: [
    'Florida B.E.S.T. standards Mathematics grade 5 site:fldoe.org',
    'Florida B.E.S.T. standards ELA grade 5 site:fldoe.org',
    'Florida B.E.S.T. standards Science grade 5 site:fldoe.org',
    'Florida B.E.S.T. standards Social Studies grade 5 site:fldoe.org'
  ],
  MN: [
    'Minnesota K-12 Academic Standards Mathematics grade 5 site:education.mn.gov',
    'Minnesota K-12 Academic Standards ELA grade 5 site:education.mn.gov',
    'Minnesota K-12 Academic Standards Science grade 5 site:education.mn.gov',
    'Minnesota K-12 Academic Standards Social Studies grade 5 site:education.mn.gov'
  ],
  NE: [
    'Nebraska College and Career Ready Standards Mathematics grade 5 site:education.ne.gov',
    'Nebraska College and Career Ready Standards ELA grade 5 site:education.ne.gov',
    'Nebraska College and Career Ready Standards Science grade 5 site:education.ne.gov',
    'Nebraska College and Career Ready Standards Social Studies grade 5 site:education.ne.gov'
  ],
  OK: [
    'Oklahoma Academic Standards Mathematics grade 5 site:sde.ok.gov',
    'Oklahoma Academic Standards ELA grade 5 site:sde.ok.gov',
    'Oklahoma Academic Standards Science grade 5 site:sde.ok.gov',
    'Oklahoma Academic Standards Social Studies grade 5 site:sde.ok.gov'
  ],
  IN: [
    'Indiana Academic Standards Mathematics grade 5 site:in.gov/doe',
    'Indiana Academic Standards ELA grade 5 site:in.gov/doe',
    'Indiana Academic Standards Science grade 5 site:in.gov/doe',
    'Indiana Academic Standards Social Studies grade 5 site:in.gov/doe'
  ],
  SC: [
    'South Carolina College- and Career-Ready Standards Mathematics grade 5 site:ed.sc.gov',
    'South Carolina College- and Career-Ready Standards ELA grade 5 site:ed.sc.gov',
    'South Carolina College- and Career-Ready Standards Science grade 5 site:ed.sc.gov',
    'South Carolina College- and Career-Ready Standards Social Studies grade 5 site:ed.sc.gov'
  ]
};

/**
 * This script generates the Firecrawl queries we'll use
 * Run with: node generate-firecrawl-queries.js
 */
function generateQueries() {
  const allQueries = [];
  
  for (const [stateCode, queries] of Object.entries(SEARCH_QUERIES)) {
    const state = STATES.find(s => s.code === stateCode);
    console.log(`\n=== ${state.name} (${stateCode}) ===`);
    console.log(`Framework: ${state.framework}`);
    
    queries.forEach((query, i) => {
      allQueries.push({
        stateCode,
        stateName: state.name,
        framework: state.framework,
        subject: ['Math', 'ELA', 'Science', 'SocialStudies'][i],
        query
      });
      console.log(`  ${['Math', 'ELA', 'Science', 'SocialStudies'][i]}: ${query}`);
    });
  }
  
  return allQueries;
}

const queries = generateQueries();

console.log('\n=== TOTAL QUERIES ===');
console.log(`${queries.length} search queries to run`);

// Save queries for batch processing
import fs from 'fs';
fs.writeFileSync(
  '/home/ibcnu/HHproduction-workdir/scripts/scraper/firecrawl-queries.json',
  JSON.stringify(queries, null, 2)
);

console.log('\nQueries saved to firecrawl-queries.json');
console.log('Ready to run firecrawl_search for each query');