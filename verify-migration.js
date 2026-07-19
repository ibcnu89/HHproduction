import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name LIKE 'stripe_%' ORDER BY column_name`);
console.log(r.rows);
pool.end();