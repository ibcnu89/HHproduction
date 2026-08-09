import { Pool } from 'pg';
import bcrypt from 'bcrypt';

async function setPassword() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const hash = await bcrypt.hash('Test123!@#', 12);
  await pool.query(`UPDATE users SET password_hash = $1 WHERE email = $2`, [hash, 'sgirten69@gmail.com']);
  console.log('Password set for sgirten69@gmail.com');
  await pool.end();
}

setPassword().catch(console.error);