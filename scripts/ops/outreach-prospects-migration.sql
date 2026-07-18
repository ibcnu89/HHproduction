-- Outreach Prospects Table Migration
-- Run: psql $DATABASE_URL -f scripts/ops/outreach-prospects-migration.sql

CREATE TABLE IF NOT EXISTS outreach_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  school VARCHAR(255),
  subject VARCHAR(100),
  grade_level VARCHAR(50),
  source VARCHAR(100), -- 'reddit', 'linkedin', 'twitter', 'referral', 'cold'
  source_url TEXT,
  pain_point TEXT,
  priority INTEGER DEFAULT 1, -- 1=high, 2=medium, 3=low
  status VARCHAR(50) DEFAULT 'new', -- 'new', 'contacted', 'replied', 'interested', 'unsubscribed', 'bounced'
  touch_count INTEGER DEFAULT 0,
  last_contacted TIMESTAMPTZ,
  last_template VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_prospects(status);
CREATE INDEX IF NOT EXISTS idx_outreach_priority ON outreach_prospects(priority);
CREATE INDEX IF NOT EXISTS idx_outreach_last_contacted ON outreach_prospects(last_contacted);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_outreach_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_outreach_prospects_updated_at ON outreach_prospects;
CREATE TRIGGER update_outreach_prospects_updated_at
  BEFORE UPDATE ON outreach_prospects
  FOR EACH ROW EXECUTE FUNCTION update_outreach_updated_at();

-- MRR Snapshots Table
CREATE TABLE IF NOT EXISTS mrr_snapshots (
  date DATE PRIMARY KEY,
  mrr_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
  active_subscriptions INTEGER DEFAULT 0,
  trialing_subscriptions INTEGER DEFAULT 0,
  past_due_subscriptions INTEGER DEFAULT 0,
  canceled_subscriptions INTEGER DEFAULT 0,
  new_subscriptions_30d INTEGER DEFAULT 0,
  churned_subscriptions_30d INTEGER DEFAULT 0,
  active_trials INTEGER DEFAULT 0,
  trial_conversions_30d INTEGER DEFAULT 0,
  raw_stripe_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grades table for trial usage tracking
CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_name VARCHAR(255),
  subject VARCHAR(100),
  grade_level VARCHAR(50),
  student_count INTEGER DEFAULT 1,
  rubric_used VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grades_user_created ON grades(user_id, created_at);

-- Add trial_expiry_notified to users if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_expiry_notified BOOLEAN DEFAULT FALSE;