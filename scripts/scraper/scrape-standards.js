/**
 * State Standards Scraper using Firecrawl
 * 
 * Usage: node scrape-standards.js [stateCode]
 * If no stateCode provided, scrapes all states
 * 
 * For Common Core states: generates standards using Common Core codes
 * For non-Common Core states: attempts to scrape state-specific standards
 */

import { STATES, SUBJECTS, GRADES } from './state-config.js';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = '/home/ibcnu/HHproduction-workdir/api/scraped-standards';
const COMMON_CORE_SOURCE = '/home/ibcnu/HHproduction-workdir/api/standards-embedded.js';

// Load Common Core data
import { commonCore } from '../standards-embedded.js';

async function scrapeStateStandards(stateCode) {
  const state = STATES.find(s => s.code === stateCode);
  if (!state) {
    console.error(`Unknown state: ${stateCode}`);
    return;
  }

  console.log(`\n=== Scraping ${state.name} (${state.code}) ===`);
  console.log(`Type: ${state.type}`);
  console.log(`DOE URL: ${state.doeUrl}`);

  if (state.type === 'commonCore') {
    // For Common Core states, we just use the commonCore data
    // The "scraping" here is just organizing the data with the state name
    return generateCommonCoreState(state);
  } else {
    // For non-Common Core states, attempt to scrape
    return await scrapeNonCommonCoreState(state);
  }
}

function generateCommonCoreState(state) {
  console.log(`  Using Common Core standards for ${state.name}`);
  
  const stateData = {
    state: state.code,
    name: state.name,
    source: 'commonCore',
    subjects: {}
  };

  for (const subject of SUBJECTS) {
    if (commonCore[subject]) {
      stateData.subjects[subject] = {};
      for (const grade of GRADES) {
        if (commonCore[subject][grade] && commonCore[subject][grade].length > 0) {
          stateData.subjects[subject][grade] = commonCore[subject][grade].map(s => ({
            code: s.code,
            description: s.description
          }));
        }
      }
    }
  }

  return stateData;
}

async function scrapeNonCommonCoreState(state) {
  console.log(`  Attempting to scrape ${state.framework} standards for ${state.name}`);
  
  // Use Firecrawl to scrape the state DOE website
  // This is a placeholder - we'll use the mcp__firecrawl__firecrawl_search tool
  // to find the actual standards pages
  
  // For now, return a template structure
  const stateData = {
    state: state.code,
    name: state.name,
    source: state.framework,
    framework: state.framework,
    subjects: {}
  };

  for (const subject of SUBJECTS) {
    stateData.subjects[subject] = {};
    for (const grade of GRADES) {
      stateData.subjects[subject][grade] = [];
    }
  }

  console.log(`  WARNING: ${state.name} standards need manual scraping`);
  console.log(`  Visit: ${state.doeUrl}`);
  
  return stateData;
}

async function main() {
  const args = process.argv.slice(2);
  const stateCode = args[0]?.toUpperCase();

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  if (stateCode) {
    // Scrape single state
    const result = await scrapeStateStandards(stateCode);
    if (result) {
      const outputFile = path.join(OUTPUT_DIR, `${stateCode.toLowerCase()}-standards.json`);
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
      console.log(`\nSaved to ${outputFile}`);
    }
  } else {
    // Scrape all states
    console.log('Scraping all 50 states...');
    const allStates = {};

    for (const state of STATES) {
      const result = await scrapeStateStandards(state.code);
      if (result) {
        allStates[state.code] = result;
      }
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 1000));
    }

    // Save combined output
    const outputFile = path.join(OUTPUT_DIR, 'all-states-standards.json');
    fs.writeFileSync(outputFile, JSON.stringify(allStates, null, 2));
    console.log(`\nSaved all states to ${outputFile}`);

    // Generate summary
    const summary = Object.entries(allStates).map(([code, data]) => ({
      code,
      name: data.name,
      type: data.source,
      subjects: Object.keys(data.subjects || {}),
      gradesWithData: {}
    }));

    Object.entries(allStates).forEach(([code, data]) => {
      const grades = {};
      Object.entries(data.subjects || {}).forEach(([subject, gradeData]) => {
        Object.entries(gradeData).forEach(([grade, standards]) => {
          if (standards.length > 0) {
            if (!grades[grade]) grades[grade] = 0;
            grades[grade] += standards.length;
          }
        });
      });
      summary.find(s => s.code === code).gradesWithData = grades;
    });

    console.log('\n=== SUMMARY ===');
    console.table(summary);
  }
}

main().catch(console.error);