import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const DOCKER = 'hh-migration-test-pg';
const CONN = 'postgres://postgres:migration-test@localhost:5598/postgres';

async function psql(sql) {
  return execFileSync('docker', ['exec', DOCKER, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' });
}
async function query(sql) {
  const c = new pg.Client({ connectionString: CONN });
  await c.connect();
  try { return await c.query(sql); } finally { await c.end(); }
}

test('migration suite: fresh DB, replay, and legacy-partial DB all succeed idempotently', async () => {
  // A. FRESH database
  spawnSync('docker', ['rm', '-f', DOCKER], { encoding: 'utf8' });
  const up = spawnSync('docker', ['run', '-d', '--name', DOCKER, '-e', 'POSTGRES_PASSWORD=migration-test', '-p', '5598:5432', 'postgres:17'], { encoding: 'utf8' });
  assert.equal(up.status, 0, 'postgres container must start');
  for (let i = 0; i < 60; i++) {
    const ready = spawnSync('docker', ['exec', DOCKER, 'pg_isready', '-U', 'postgres'], { encoding: 'utf8' });
    if (ready.status === 0) break;
    await new Promise(r => setTimeout(r, 500));
  }
  // pg_isready accepts connections before the postmaster fully finishes
  // initialization; give real queries a moment to succeed reliably.
  await new Promise(r => setTimeout(r, 1000));

  const runMigrate = () => {
    const r = spawnSync('node', ['scripts/migrate.js'], {
      cwd: root, encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: CONN },
    });
    return r;
  };

  // Run 1: fresh
  const r1 = runMigrate();
  assert.equal(r1.status, 0, `fresh migration must succeed: ${r1.stderr?.slice(-400)}`);
  const tables = await query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1");
  for (const expected of ['users', 'sessions', 'students', 'oauth_states', 'password_reset_tokens', 'ai_usage', 'batch_grading_sessions']) {
    assert.ok(tables.rows.some(t => t.table_name === expected), `fresh DB must have ${expected}`);
  }

  // Run 2: replay on same DB — must be a clean no-op success
  const r2 = runMigrate();
  assert.equal(r2.status, 0, `replay must succeed: ${r2.stderr?.slice(-400)}`);
  assert.doesNotMatch(r2.stdout, /Applied/, 'replay must apply nothing');

  // B. LEGACY PARTIAL DB: simulate a database where 009's objects (and
  // users etc.) already exist but schema_migrations has no records —
  // the exact "existing HomeworkHelper database" from the audit.
  await psql('DROP TABLE IF EXISTS schema_migrations');
  // students + its trigger already exist (created outside the runner):
  const r9 = runMigrate();
  assert.equal(r9.status, 0, `legacy-partial migration must succeed past 009: ${r9.stderr?.slice(-600)}`);
  const trig = await query("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgrelid='students'::regclass");
  assert.ok(trig.rows.some(t => t.tgname === 'update_students_updated_at'), 'trigger must exist exactly once');
  assert.equal(trig.rows.filter(t => t.tgname === 'update_students_updated_at').length, 1, 'exactly one trigger (no duplicate)');
  // newer migrations reached and recorded
  const rec = await query('SELECT name FROM schema_migrations');
  assert.ok(rec.rows.some(r => r.name === 'migrations/018_oauth_states.sql'), '018 must be applied after legacy partial state');
  assert.ok(rec.rows.some(r => r.name === 'migrations/020_ai_usage.sql'), '020 must be applied after legacy partial state');

  // C. data-preservation: rows survive the legacy re-run
  await query("INSERT INTO users (email, google_id, name) VALUES ('survivor@example.test', 'g-survivor', 'Survivor')");
  const cnt = await query("SELECT COUNT(*)::int AS n FROM users WHERE email='survivor@example.test'");
  assert.equal(cnt.rows[0].n, 1, 'data inserted before re-run must survive');

  // D. trigger functional correctness: update bumps updated_at
  const before = await query("SELECT updated_at FROM users WHERE email='survivor@example.test'");
  await new Promise(r => setTimeout(r, 1100));
  await query("UPDATE users SET name='Survivor2' WHERE email='survivor@example.test'");
  const after = await query("SELECT updated_at FROM users WHERE email='survivor@example.test'");
  assert.ok(after.rows[0].updated_at > before.rows[0].updated_at, 'updated_at trigger must still work');

  spawnSync('docker', ['rm', '-f', DOCKER], { encoding: 'utf8' });
});

test('every migration file is replay-safe by construction (no unguarded CREATE TRIGGER)', () => {
  const dir = `${root}/migrations`;
  const files = ['004_batch_grading_sessions.sql','005_user_preferences.sql','009_students.sql'];
  for (const f of files) {
    const sql = readFileSync(`${dir}/${f}`, 'utf8');
    const unguarded = [...sql.matchAll(/^CREATE TRIGGER (\w+)/gm)].map(m => m[1]);
    for (const name of unguarded) {
      const guarded = new RegExp(`DROP TRIGGER IF EXISTS ${name}`, 'm').test(sql);
      assert.ok(guarded, `${f}: trigger ${name} must be preceded by DROP TRIGGER IF EXISTS`);
    }
  }
});
