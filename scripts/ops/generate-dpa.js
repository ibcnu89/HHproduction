#!/usr/bin/env node
/**
 * DPA Generator Script
 * Generates a filled Data Processing Agreement for a specific school district
 * 
 * Usage: node scripts/ops/generate-dpa.js --district "District Name" --contact "Contact Name" --email "contact@district.edu" --state "IL"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      options[key] = args[i + 1];
      i++;
    }
  }
  return options;
}

function generateDPA(options) {
  const {
    district = '[DISTRICT NAME]',
    contact = '[CONTACT NAME]',
    email = '[CONTACT EMAIL]',
    state = '[STATE]',
    date = new Date().toISOString().split('T')[0],
    effectiveDate = new Date().toISOString().split('T')[0],
  } = options;

  const templatePath = path.join(__dirname, '..', '..', 'docs', 'DPA_TEMPLATE.md');
  let template = fs.readFileSync(templatePath, 'utf8');

  // Replace placeholders
  const replacements = {
    '\\[DISTRICT NAME\\]': district,
    '\\[CONTACT NAME\\]': contact,
    '\\[CONTACT EMAIL\\]': email,
    '\\[STATE\\]': state,
    '\\[DATE\\]': date,
    '\\[EFFECTIVE DATE\\]': effectiveDate,
    '\\[NAME\\]': '[AUTHORIZED SIGNATORY NAME]',
    '\\[TITLE\\]': '[TITLE]',
  };

  let output = template;
  for (const [pattern, value] of Object.entries(replacements)) {
    output = output.replace(new RegExp(pattern, 'g'), value);
  }

  // Replace date placeholders
  output = output.replace(/\\[DATE\\]/g, date);
  output = output.replace(/\\[EFFECTIVE DATE\\]/g, effectiveDate);

  return output;
}

function main() {
  const options = parseArgs();
  
  if (!options.district || options.district === '[DISTRICT NAME]') {
    console.error('Error: --district is required');
    console.log('Usage: node generate-dpa.js --district "District Name" --contact "Contact Name" --email "contact@district.edu" --state "IL"');
    process.exit(1);
  }

  const dpa = generateDPA(options);
  
  // Create output directory
  const outputDir = path.join(__dirname, '..', '..', 'content', 'legal', 'dpa');
  fs.mkdirSync(outputDir, { recursive: true });
  
  const safeName = options.district.replace(/[^a-zA-Z0-9]/g, '_');
  const outputPath = path.join(outputDir, `DPA_${safeName}_${new Date().toISOString().split('T')[0]}.md`);
  
  fs.writeFileSync(outputPath, dpa);
  
  console.log(`✓ DPA generated: ${outputPath}`);
  console.log(`  District: ${options.district}`);
  console.log(`  Contact: ${options.contact}`);
  console.log(`  Email: ${options.email}`);
  console.log(`  State: ${options.state}`);
}

main();