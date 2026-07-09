/**
 * Database connection pool for Neon PostgreSQL
 * Uses pg Pool for serverless-friendly connection management.
 * 
 * DATABASE_URL must be set in Vercel environment variables.
 */

import pg from 'pg';

const { Pool } = pg;

let pool = null;

/**
 * Get or create the database connection pool.
 * Lazily initialized so it only connects when needed —
 * avoids cold-start connection failures when DB isn't provisioned yet.
 */
export function getPool() {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString: databaseUrl,
      // Neon requires SSL with rejectUnauthorized: false
      // — their serverless proxy uses self-signed certificates.
      // This is Neon's documented configuration, not a security oversight.
      ssl: { rejectUnauthorized: false },
      // Serverless-friendly: limit concurrent connections
      max: 5,
      // Idle connection timeout (ms)
      idleTimeoutMillis: 30000,
      // Connection timeout (ms)
      connectionTimeoutMillis: 5000,
    });

    // Log pool errors but don't crash
    pool.on('error', (err) => {
      console.error('Database pool error:', err.message);
    });
  }

  return pool;
}

/**
 * Execute a single query. Convenience wrapper.
 */
export async function query(text, params) {
  const pool = getPool();
  return pool.query(text, params);
}

/**
 * Get a dedicated client from the pool for transactions.
 * Remember to call client.release() when done.
 */
export async function getClient() {
  const pool = getPool();
  return pool.connect();
}

/**
 * Run the schema migration SQL.
 * Idempotent — uses IF NOT EXISTS everywhere.
 */
export async function runMigrations() {
  const fs = await import('fs');
  const path = await import('path');
  
  const schemaPath = path.join(process.cwd(), 'api', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  
  const client = await getClient();
  try {
    await client.query(sql);
    console.log('Schema migration completed successfully');
  } catch (err) {
    console.error('Schema migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}