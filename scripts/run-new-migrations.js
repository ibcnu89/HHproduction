/**
 * Run New Database Migrations Only
 * Executes only the new migration files (008, 009, etc.)
 * Usage: node scripts/run-new-migrations.js
 */

import { getClient } from '../lib/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runNewMigrations() {
  console.log('Starting new database migrations...');
  
  try {
    const migrationsDir = path.join(process.cwd(), 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b))
      // Only run migrations >= 008
      .filter(f => {
        const num = parseInt(f.split('_')[0], 10);
        return num >= 8;
      });
    
    if (migrationFiles.length === 0) {
      console.log('No new migrations to run');
      return;
    }
    
    console.log(`Found ${migrationFiles.length} new migration files`);
    
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`Running migration: ${file}...`);
      const client = await getClient();
      try {
        await client.query(sql);
        console.log(`✓ ${file} complete`);
      } catch (err) {
        // Check if it's just "already exists" error
        if (err.message.includes('already exists') || err.code === '42P07' || err.code === '42710') {
          console.log(`⊘ ${file} already applied (relation exists), skipping`);
        } else {
          console.error(`✗ ${file} failed:`, err.message);
          throw err;
        }
      } finally {
        client.release();
      }
    }
    
    console.log('\n✓ All new migrations completed successfully!');
    
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

runNewMigrations();