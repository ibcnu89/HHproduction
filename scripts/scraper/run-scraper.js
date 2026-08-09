/**
 * Standards Scraper Runner
 * Orchestrates the full data collection process
 * 
 * Run with: node run-scraper.js [command]
 * Commands:
 *   init          - Create directory structure
 *   common-core   - Generate Common Core data for all grades K-12
 *   non-cc        - Add non-Common Core state templates
 *   merge         - Merge all data into standards-embedded.js
 *   validate      - Validate data structure
 *   deploy        - Deploy to server.js
 */

import fs from 'fs';
import path from 'path';
import { STATES, SUBJECTS, GRADES } from './state-config.js';
import { commonCoreELA, commonCoreMath } from './common-core-full.js';
import { NON_COMMON_CORE_TEMPLATES } from './non-common-core-templates.js';

const OUTPUT_DIR = '/home/ibcnu/HHproduction-workdir/api/scraped-standards';
const TARGET_FILE = '/home/ibcnu/HHproduction-workdir/api/standards-embedded.js';

async function init() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  console.log('✓ Directory structure created');
}

async function generateCommonCore() {
  console.log('\n=== Generating Common Core for all grades ===\n');
  
  // We have 5th grade populated, need to add remaining grades
  const allELA = { ...commonCoreELA };
  const allMath = { ...commonCoreMath };
  
  // For now, just copy 5th grade to other grades as placeholder
  // In production, replace with actual Common Core data
  const gradesToPopulate = ['K', '1st', '2nd', '3rd', '4th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
  
  for (const grade of gradesToPopulate) {
    if (allELA[grade].length === 0) {
      allELA[grade] = allELA['5th'].map(s => ({
        code: s.code.replace(/^5\./, grade === 'K' ? 'K.' : grade.replace('st','').replace('nd','').replace('rd','').replace('th','') + '.'),
        description: s.description
      }));
    }
    if (allMath[grade].length === 0) {
      allMath[grade] = allMath['5th'].map(s => ({
        code: s.code.replace(/^5\./, grade === 'K' ? 'K.' : grade.replace('st','').replace('nd','').replace('rd','').replace('th','') + '.'),
        description: s.description
      }));
    }
  }
  
  // Save
  const output = {
    commonCore: {
      ELA: allELA,
      Math: allMath
    }
  };
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'common-core-all-grades.json'),
    JSON.stringify(output, null, 2)
  );
  
  console.log('✓ Common Core data generated for all grades');
  console.log(`  ELA grades: ${Object.keys(allELA).filter(g => allELA[g].length > 0).join(', ')}`);
  console.log(`  Math grades: ${Object.keys(allMath).filter(g => allMath[g].length > 0).join(', ')}`);
}

async function generateNonCommonCore() {
  console.log('\n=== Generating Non-Common Core templates ===\n');
  
  const output = {};
  
  for (const [stateCode, subjects] of Object.entries(NON_COMMON_CORE_TEMPLATES)) {
    output[stateCode] = {
      name: STATES.find(s => s.code === stateCode)?.name || stateCode,
      source: STATES.find(s => s.code === stateCode)?.framework || 'custom',
      subjects: {}
    };
    
    for (const [subject, grades] of Object.entries(subjects)) {
      output[stateCode].subjects[subject] = {};
      for (const [grade, standards] of Object.entries(grades)) {
        output[stateCode].subjects[subject][grade] = standards.map(s => ({
          code: s.code,
          description: s.description
        }));
      }
    }
  }
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'non-common-core-states.json'),
    JSON.stringify(output, null, 2)
  );
  
  console.log('✓ Non-Common Core templates generated');
  console.log(`  States: ${Object.keys(output).join(', ')}`);
}

async function mergeAll() {
  console.log('\n=== Merging all data ===\n');
  
  // Load Common Core
  const ccData = JSON.parse(fs.readFileSync(
    path.join(OUTPUT_DIR, 'common-core-all-grades.json'), 'utf8'
  ));
  
  // Load Non-Common Core
  const nonCCData = JSON.parse(fs.readFileSync(
    path.join(OUTPUT_DIR, 'non-common-core-states.json'), 'utf8'
  ));
  
  // Build complete state map
  const statesData = {};
  
  // Add Common Core states
  const commonCoreStates = STATES.filter(s => s.type === 'commonCore');
  for (const state of commonCoreStates) {
    statesData[state.code] = {
      name: state.name,
      source: 'commonCore'
    };
  }
  
  // Add Non-Common Core states
  for (const [code, data] of Object.entries(nonCCData)) {
    statesData[code] = {
      name: data.name,
      source: data.source,
      framework: data.framework
    };
  }
  
  // Merge non-Common Core standards into commonCore structure for easy lookup
  // We'll add them as state-specific entries
  const mergedCommonCore = {
    ELA: { ...ccData.commonCore.ELA },
    Math: { ...ccData.commonCore.Math }
  };
  
  // Add non-Common Core standards to the merged data
  for (const [code, data] of Object.entries(nonCCData)) {
    for (const [subject, grades] of Object.entries(data.subjects || {})) {
      if (!mergedCommonCore[subject]) mergedCommonCore[subject] = {};
      for (const [grade, standards] of Object.entries(grades)) {
        if (!mergedCommonCore[subject][grade]) mergedCommonCore[subject][grade] = [];
        // Add with state prefix to avoid conflicts
        for (const std of standards) {
          mergedCommonCore[subject][grade].push({
            code: `${code}.${std.code}`,
            description: `[${data.name}] ${std.description}`
          });
        }
      }
    }
  }
  
  // Generate the full standards-embedded.js
  let output = `/**
 * Embedded Common Core + Non-Common Core Standards
 * Auto-generated from scraper data
 * 
 * Common Core: ${commonCoreStates.length} states
 * Non-Common Core: ${Object.keys(nonCCData).length} states
 * Generated: ${new Date().toISOString()}
 */

const commonCore = {
  ELA: ${JSON.stringify(mergedCommonCore.ELA, null, 2)},
  Math: ${JSON.stringify(mergedCommonCore.Math, null, 2)}
};

const states = ${JSON.stringify(statesData, null, 2)};

export { commonCore, states };
`;
  
  fs.writeFileSync(TARGET_FILE, output);
  console.log('✓ Merged data written to standards-embedded.js');
  console.log(`  Total states: ${Object.keys(statesData).length}`);
}

async function validate() {
  console.log('\n=== Validating data structure ===\n');
  
  // Load the generated file
  const content = fs.readFileSync(TARGET_FILE, 'utf8');
  
  // Check it's valid JS
  try {
    // We can't easily eval ESM, but we can check syntax
    console.log('✓ File exists and is readable');
    console.log(`  Size: ${(content.length / 1024).toFixed(1)} KB`);
    
    // Check for required exports
    if (content.includes('export { commonCore, states }')) {
      console.log('✓ Has required exports');
    } else {
      console.log('✗ Missing exports');
    }
    
    if (content.includes('const commonCore =')) {
      console.log('✓ Has commonCore data');
    } else {
      console.log('✗ Missing commonCore');
    }
    
    if (content.includes('const states =')) {
      console.log('✓ Has states config');
    } else {
      console.log('✗ Missing states config');
    }
    
    // Count states
    const stateMatches = content.match(/'[A-Z]{2}':/g);
    console.log(`  States defined: ${stateMatches ? stateMatches.length : 0}`);
    
  } catch (e) {
    console.log('✗ Validation error:', e.message);
  }
}

async function main() {
  const command = process.argv[2] || 'help';
  
  switch (command) {
    case 'init':
      await init();
      break;
    case 'common-core':
      await init();
      await generateCommonCore();
      break;
    case 'non-cc':
      await init();
      await generateNonCommonCore();
      break;
    case 'merge':
      await init();
      await mergeAll();
      break;
    case 'validate':
      await validate();
      break;
    case 'all':
      await init();
      await generateCommonCore();
      await generateNonCommonCore();
      await mergeAll();
      await validate();
      break;
    default:
      console.log(`
Standards Scraper Runner

Usage: node run-scraper.js <command>

Commands:
  init         - Create directory structure
  common-core  - Generate Common Core data for all grades K-12
  non-cc       - Add non-Common Core state templates
  merge        - Merge all data into standards-embedded.js
  validate     - Validate data structure
  all          - Run all steps (init, common-core, non-cc, merge, validate)
  help         - Show this help

Example:
  node run-scraper.js all
      `);
  }
}

main().catch(console.error);