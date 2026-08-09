-- User Preferences (append-only)
-- ============================================================
-- Stores per-user settings like state for standards, etc.
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state_code CHAR(2),                          -- US state code: 'CA', 'TX', 'IL', etc.
  grade_level VARCHAR(10),                     -- 'K', '1', '2', ..., '12'
  subject VARCHAR(50),                         -- 'Math', 'ELA', 'Science', etc.
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Index for queries
CREATE INDEX IF NOT EXISTS idx_user_preferences_state ON user_preferences(state_code);