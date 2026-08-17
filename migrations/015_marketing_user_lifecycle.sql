-- 015: Marketing User Lifecycle
-- Adds columns to users for the welcome drip + high-intent scoring + win-back,
-- plus a log table for every drip/winback email sent (dedupe + audit).
-- Run: psql $DATABASE_URL -f migrations/015_marketing_user_lifecycle.sql

-- ---------------------------------------------------------------------------
-- 1. User lifecycle flags (plain columns -- subscription_status is GENERATED,
--    so we CANNOT store tags on it; these live alongside it.)
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS high_intent          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS high_intent_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS welcome_drip_started TIMESTAMPTZ,   -- set on enrollment
  ADD COLUMN IF NOT EXISTS drip_shortened       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trial_expired_at     TIMESTAMPTZ,  -- set when trial lapses (replaces broken trial_converted_at references)
  ADD COLUMN IF NOT EXISTS winback_day1_sent    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS winback_day3_sent    BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_lifecycle
  ON users (subscription_status, high_intent, welcome_drip_started);

-- ---------------------------------------------------------------------------
-- 2. Drip / winback email send log (dedupe + audit + report source)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_drip_emails (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_type    VARCHAR(50) NOT NULL, -- 'drip_day1'|'drip_day3'|'drip_day5'|'drip_day7'|'winback_day1'|'winback_day3'
  variant       VARCHAR(20) DEFAULT 'standard', -- 'standard' or 'high_intent'
  subject       TEXT,
  sent_at       TIMESTAMPTZ DEFAULT NOW(),
  resend_id     TEXT,               -- external Resend email id
  error         TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_drip_emails_user   ON user_drip_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_user_drip_emails_unique ON user_drip_emails(user_id, email_type);
CREATE INDEX IF NOT EXISTS idx_user_drip_emails_sent   ON user_drip_emails(sent_at);