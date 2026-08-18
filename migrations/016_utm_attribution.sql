-- 016: UTM source attribution
-- Captures which marketing channel (facebook group, reddit post, etc.) brought
-- each user to signup/trial. Set from a frontend cookie (hh_utm) read at
-- user-creation time, for BOTH email register and Google OAuth new-user paths.
-- Run: psql $DATABASE_URL -f migrations/016_utm_attribution.sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS utm_source   TEXT,  -- facebook, reddit, twitter, blog, direct
  ADD COLUMN IF NOT EXISTS utm_medium   TEXT,  -- social, email, cpc, referral
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT;  -- fb-week1-day1, reddit-roast, etc.

CREATE INDEX IF NOT EXISTS idx_users_utm_source ON users(utm_source);