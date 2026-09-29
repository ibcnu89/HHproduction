import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const DOCKER = 'hh-migration-test-pg';
// A. disposable, isolated test database: its own container on its own
// port, created and destroyed by this test. Never production.
const CONN = 'postgres://postgres:migration-test@localhost:5598/postgres';

async function psql(sql) {
  return execFileSync('docker', ['exec', DOCKER, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' });
}
async function query(sql, params) {
  const c = new pg.Client({ connectionString: CONN });
  await c.connect();
  try { return await c.query(sql, params); } finally { await c.end(); }
}

test('legacy replay preserves pre-existing user AND student data; 009 students trigger functional (A-I)', async () => {
  // A. fresh disposable instance
  spawnSync('docker', ['rm', '-f', DOCKER], { encoding: 'utf8' });
  const up = spawnSync('docker', ['run', '-d', '--name', DOCKER, '-e', 'POSTGRES_PASSWORD=migration-test', '-p', '5598:5432', 'postgres:17'], { encoding: 'utf8' });
  assert.equal(up.status, 0, 'disposable postgres container must start');
  for (let i = 0; i < 60; i++) {
    const ready = spawnSync('docker', ['exec', DOCKER, 'pg_isready', '-U', 'postgres'], { encoding: 'utf8' });
    if (ready.status === 0) break;
    await new Promise(r => setTimeout(r, 500));
  }
  await new Promise(r => setTimeout(r, 1000));

  const runMigrate = () => spawnSync('node', ['scripts/migrate.js'], {
    cwd: root, encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: CONN },
  });

  // B. migrate to the pre-replay state (full fresh run)
  const rB = runMigrate();
  assert.equal(rB.status, 0, `initial migration must succeed: ${rB.stderr?.slice(-400)}`);

  // C. BEFORE replay: seed representative EXISTING data; record
  // identifiers and values for exact comparison after the replay.
  const userSeed = await query(
    "INSERT INTO users (email, google_id, name, avatar_url) VALUES ('existing-teacher@example.test', 'g-existing', 'Existing Teacher', 'pic.png') RETURNING id, email, name, created_at"
  );
  assert.equal(userSeed.rows.length, 1, 'user seed must insert');
  const userId = userSeed.rows[0].id;
  const studentSeed = await query(
    "INSERT INTO students (teacher_id, classroom_student_id, classroom_course_id, name, email, local_identifier) VALUES ($1, 'gc-student-1', 'gc-course-1', 'Existing Student', 'student@example.test', 'Period 3, Seat 5') RETURNING id, name, email, local_identifier, created_at",
    [userId]
  );
  assert.equal(studentSeed.rows.length, 1, 'student seed must insert');
  const studentId = studentSeed.rows[0].id;
  const userSnapshot = userSeed.rows[0];
  const studentSnapshot = studentSeed.rows[0];
  const userCount = (await query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n;
  const studentCount = (await query('SELECT COUNT(*)::int AS n FROM students')).rows[0].n;

  // D. simulate the legacy/partial condition: 009's objects already
  // exist (applied in B) but migration BOOKKEEPING is missing, so the
  // runner re-encounters 009 and must not abort, duplicate the trigger,
  // or disturb the seeded rows. This is the real failure mode from the
  // audit: replay over an existing HomeworkHelper database whose
  // schema_migrations history is incomplete.
  await psql('DROP TABLE IF EXISTS schema_migrations');
  await query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');

  // E. run the migration runner (replay)
  const rE = runMigrate();
  assert.equal(rE.status, 0, `legacy-partial replay must succeed: ${rE.stderr?.slice(-600)}`);

  // F1. pre-existing USER data unchanged (exact comparison)
  const userAfter = (await query('SELECT id, email, name, created_at FROM users WHERE id = $1', [userId])).rows[0];
  assert.ok(userAfter, 'pre-existing user row must survive replay');
  assert.equal(userAfter.id, userSnapshot.id, 'user id unchanged');
  assert.equal(userAfter.email, userSnapshot.email, 'user email unchanged');
  assert.equal(userAfter.name, userSnapshot.name, 'user name unchanged');
  assert.equal(String(userAfter.created_at), String(userSnapshot.created_at), 'user created_at unchanged');

  // F2. pre-existing STUDENT data unchanged (exact comparison)
  const studentAfter = (await query('SELECT id, name, email, local_identifier, created_at FROM students WHERE id = $1', [studentId])).rows[0];
  assert.ok(studentAfter, 'pre-existing student row must survive replay');
  assert.equal(studentAfter.id, studentSnapshot.id, 'student id unchanged');
  assert.equal(studentAfter.name, studentSnapshot.name, 'student name unchanged');
  assert.equal(studentAfter.email, studentSnapshot.email, 'student email unchanged');
  assert.equal(studentAfter.local_identifier, studentSnapshot.local_identifier, 'student local_identifier unchanged');
  assert.equal(String(studentAfter.created_at), String(studentSnapshot.created_at), 'student created_at unchanged');

  // F3. no data loss or duplication: counts unchanged by replay
  assert.equal((await query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n, userCount, 'user count must be unchanged by replay');
  assert.equal((await query('SELECT COUNT(*)::int AS n FROM students')).rows[0].n, studentCount, 'student count must be unchanged by replay');

  // F4. runner completed; newer migrations remain reachable
  const rec = await query('SELECT name FROM schema_migrations ORDER BY name');
  const names = rec.rows.map(r => r.name);
  assert.ok(names.includes('migrations/009_students.sql'), '009 must be recorded by the replay');
  assert.ok(names.includes('migrations/018_oauth_states.sql'), '018 must be reachable after 009');
  assert.ok(names.includes('migrations/020_ai_usage.sql'), '020 must be reachable after 009');
  assert.ok(rE.stdout.includes('Applied'), 'replay must report applied migrations');

  // F5. exactly ONE 009 students trigger; no duplicates
  const trig = await query("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgrelid='students'::regclass");
  const matching = trig.rows.filter(t => t.tgname === 'update_students_updated_at');
  assert.equal(matching.length, 1, `exactly one update_students_updated_at trigger (got ${matching.length})`);

  // G. exercise the ACTUAL 009 students trigger (not the users one)
  const before = (await query('SELECT updated_at FROM students WHERE id = $1', [studentId])).rows[0].updated_at;
  await new Promise(r => setTimeout(r, 1100)); // visible timestamp delta
  await query("UPDATE students SET name = 'Existing Student Renamed' WHERE id = $1", [studentId]);
  const after = (await query('SELECT updated_at FROM students WHERE id = $1', [studentId])).rows[0].updated_at;
  assert.ok(after > before, '009 students trigger must bump updated_at on UPDATE');
  const renamed = (await query('SELECT name FROM students WHERE id = $1', [studentId])).rows[0].name;
  assert.equal(renamed, 'Existing Student Renamed', 'student rename must persist');

  // H. second full runner pass: idempotent no-op
  const rH = runMigrate();
  assert.equal(rH.status, 0, `second run must succeed: ${rH.stderr?.slice(-400)}`);
  assert.doesNotMatch(rH.stdout, /Applied/, 'second run must apply nothing (no-op)');
  const trig2 = await query("SELECT COUNT(*)::int AS n FROM pg_trigger WHERE NOT tgisinternal AND tgrelid='students'::regclass AND tgname='update_students_updated_at'");
  assert.equal(trig2.rows[0].n, 1, 'still exactly one trigger after second run');
  assert.equal((await query('SELECT COUNT(*)::int AS n FROM users WHERE id=$1', [userId])).rows[0].n, 1, 'user row survives second run');
  assert.equal((await query('SELECT COUNT(*)::int AS n FROM students WHERE id=$1', [studentId])).rows[0].n, 1, 'student row survives second run');

  // I. cleanup the disposable instance
  spawnSync('docker', ['rm', '-f', DOCKER], { encoding: 'utf8' });
});

test('fresh-install path still works end-to-end on a brand-new disposable DB', async () => {
  // Regression guard: the replay fix must not break the simple case.
  spawnSync('docker', ['rm', '-f', DOCKER], { encoding: 'utf8' });
  const up = spawnSync('docker', ['run', '-d', '--name', DOCKER, '-e', 'POSTGRES_PASSWORD=migration-test', '-p', '5598:5432', 'postgres:17'], { encoding: 'utf8' });
  assert.equal(up.status, 0, 'container starts');
  for (let i = 0; i < 60; i++) {
    const ready = spawnSync('docker', ['exec', DOCKER, 'pg_isready', '-U', 'postgres'], { encoding: 'utf8' });
    if (ready.status === 0) break;
    await new Promise(r => setTimeout(r, 500));
  }
  await new Promise(r => setTimeout(r, 1000));
  const runMigrate = () => spawnSync('node', ['scripts/migrate.js'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, DATABASE_URL: CONN },
  });
  const r1 = runMigrate();
  assert.equal(r1.status, 0, `fresh install must succeed: ${r1.stderr?.slice(-400)}`);
  const tables = await query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1");
  for (const expected of ['users', 'sessions', 'students', 'oauth_states', 'password_reset_tokens', 'ai_usage', 'batch_grading_sessions']) {
    assert.ok(tables.rows.some(t => t.table_name === expected), `fresh DB must have ${expected}`);
  }
  const r2 = runMigrate();
  assert.equal(r2.status, 0, 'immediate second run must succeed');
  assert.doesNotMatch(r2.stdout, /Applied/, 'second run applies nothing');
  const trig = await query("SELECT COUNT(*)::int AS n FROM pg_trigger WHERE NOT tgisinternal AND tgrelid='students'::regclass AND tgname='update_students_updated_at'");
  assert.equal(trig.rows[0].n, 1, 'fresh install has exactly one students trigger');
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
  assert.ok(existsSync(`${dir}/009_students.sql`), '009 file must exist');
});
