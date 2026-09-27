import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getPool } from '../lib/db.js';

const root = new URL('../', import.meta.url);
const pool = getPool();
const client = await pool.connect();
try {
  await client.query('SELECT pg_advisory_lock(4821901)');
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  const files = ['api/schema.sql', ...(await readdir(new URL('migrations/', root))).filter(f => /^\d+.*\.sql$/.test(f)).sort().map(f => `migrations/${f}`)];
  for (const file of files) {
    if ((await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file])).rowCount) continue;
    await client.query('BEGIN');
    try {
      await client.query(await readFile(new URL(file, root), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied ${file}`);
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  }
} catch (error) {
  console.error(`Migration failed (${error.code || 'unknown'}); no credentials logged. Check ${fileURLToPath(new URL('migrations/', root))}.`);
  process.exitCode = 1;
} finally {
  await client.query('SELECT pg_advisory_unlock(4821901)');
  client.release();
  await pool.end();
}
