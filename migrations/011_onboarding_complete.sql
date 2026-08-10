-- Add onboarding_complete to user_preferences
-- ============================================================
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;

-- Index for onboarding queries (optional, for dashboard metrics)
CREATE INDEX IF NOT EXISTS idx_user_preferences_onboarding ON user_preferences(onboarding_complete);