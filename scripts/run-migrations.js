/**
 * Run Database Migrations
 * Executes all migration files in order
 * Usage: node scripts/run-migrations.js
 */

import { getClient, runMigrations } from '../lib/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runAllMigrations() {
  console.log('Starting database migrations...');
  
  try {
    // First run the main schema
    console.log('Running main schema...');
    await runMigrations();
    console.log('✓ Main schema complete');
    
    // Run additional migrations in order
    const migrationsDir = path.join(process.cwd(), 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));
    
    console.log(`Found ${migrationFiles.length} migration files`);
    
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`Running migration: ${file}...`);
      const client = await getClient();
      try {
        await client.query(sql);
        console.log(`✓ ${file} complete`);
      } catch (err) {
        console.error(`✗ ${file} failed:`, err.message);
        throw err;
      } finally {
        client.release();
      }
    }
    
    console.log('\n✓ All migrations completed successfully!');
    
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

runAllMigrations();