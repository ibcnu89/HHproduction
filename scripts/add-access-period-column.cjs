const { Pool } = require('pg');
const fs = require('fs');

async function runMigration() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync('migrations/007_stripe_access_period.sql', 'utf8');
  await pool.query(sql);
  console.log('Column added');
  await pool.end();
}

runMigration().catch(console.error);