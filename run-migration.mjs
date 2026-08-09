import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigration() {
  const client = await pool.connect();
  try {
    const migration = `
-- User Preferences (append-only)
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state_code CHAR(2),
  grade_level VARCHAR(10),
  subject VARCHAR(50),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_user_preferences_state ON user_preferences(state_code);
    `;
    
    await client.query(migration);
    console.log('Migration completed successfully');
    
    // Verify
    const result = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_preferences'"
    );
    console.log('Table columns:', JSON.stringify(result.rows, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);