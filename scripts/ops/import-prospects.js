#!/usr/bin/env node
/**
 * Import prospects from outreach_db.json into PostgreSQL outreach_prospects table
 * Run: DATABASE_URL=postgresql://... node scripts/ops/import-prospects.js
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('DATABASE_URL environment variable required');
  console.error('Get it from Railway dashboard → your project → Variables → DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DB_URL,
  // Neon requires SSL but uses self-signed certs in some environments
  // rejectUnauthorized: false is acceptable for Neon managed PostgreSQL
  ssl: { rejectUnauthorized: false },
});

const PROSPECTS_FILE = path.join(__dirname, '..', '..', 'prospects', 'outreach_db.json');

function normalizePhone(phone) {
  if (!phone || phone === '(none found)') return null;
  // Normalize to E.164 format
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return phone;
}

function normalizeEmail(email) {
  if (!email || email === '(none found)') return null;
  return email.toLowerCase();
}

function extractState(city) {
  if (!city) return 'IL';
  const parts = city.split(', ');
  return parts[parts.length - 1] || 'IL';
}

function extractDistrict(notes) {
  if (!notes) return null;
  const addressMatch = notes.match(/Address:\s*([^|]+)/);
  if (!addressMatch) return null;
  const address = addressMatch[1].trim();
  // District is often the second-to-last part before state/zip
  const parts = address.split(',');
  if (parts.length >= 2) {
    return parts[parts.length - 2].trim();
  }
  return null;
}

async function main() {
  const client = await pool.connect();
  
  try {
    // Read prospects file
    const data = JSON.parse(fs.readFileSync(PROSPECTS_FILE, 'utf8'));
    const leads = data.leads || {};
    
    console.log(`Found ${Object.keys(leads).length} prospects to import`);
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const [key, lead] of Object.entries(leads)) {
      try {
        const email = normalizeEmail(lead.email);
        const phone = normalizePhone(lead.phone);
        const state = extractState(lead.city);
        const district = extractDistrict(lead.notes);
        
        // Check if already exists (by email or phone)
        let existing = null;
        if (email) {
          existing = await client.query(
            'SELECT id FROM outreach_prospects WHERE email = $1',
            [email]
          );
        }
        if (!existing || existing.rows.length === 0) {
          if (phone) {
            existing = await client.query(
              'SELECT id FROM outreach_prospects WHERE phone = $1',
              [phone]
            );
          }
        }
        
        if (existing && existing.rows.length > 0) {
          skipped++;
          continue;
        }
        
        // Determine subject/role from service field
        let subject = 'General';
        const service = lead.service || '';
        if (service.includes('Elementary')) subject = 'Elementary';
        else if (service.includes('Middle')) subject = 'Middle School';
        else if (service.includes('High')) subject = 'High School';
        else if (service.includes('Teacher')) subject = 'General';
        
        // Insert new prospect
        await client.query(`
          INSERT INTO outreach_prospects (
            email, phone, first_name, last_name, subject, school, district, state,
            source, source_url, status, touch_count, last_contacted, next_followup,
            notes, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (email) DO NOTHING
        `, [
          email,
          phone,
          null, // first_name - we don't have individual teacher names
          null, // last_name
          subject,
          lead.business_name,
          district,
          state,
          'nces_api',
          lead.website !== '(not found)' ? lead.website : null,
          lead.status,
          0,
          lead.last_outreach_at || null,
          lead.follow_up_due || null,
          lead.notes,
          lead.created_at,
          lead.updated_at
        ]);
        
        imported++;
        
        if (imported % 50 === 0) {
          console.log(`Imported ${imported} prospects...`);
        }
        
      } catch (err) {
        console.error(`Error importing ${key}:`, err.message);
        errors++;
      }
    }
    
    console.log(`\n=== Import Complete ===`);
    console.log(`Imported: ${imported}`);
    console.log(`Skipped (duplicates): ${skipped}`);
    console.log(`Errors: ${errors}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});