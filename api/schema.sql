-- HHproduction Database Schema
-- Target: Neon PostgreSQL
-- Run: psql $DATABASE_URL -f api/schema.sql

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),           -- NULL for Google-only users
  google_id VARCHAR(255) UNIQUE,        -- NULL for email-only users
  name VARCHAR(255),
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions table (refresh token tracking)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(255) NOT NULL,
  user_agent TEXT,
  ip_hash VARCHAR(255),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Auto-update updated_at on users
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- BILLING / SUBSCRIPTION MIGRATION (append-only, never edit above)
-- ============================================================

-- Add Stripe subscription columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_current_period_end TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS stripe_trial_end TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) GENERATED ALWAYS AS (
    CASE
      WHEN stripe_subscription_status IS NULL THEN 'no_subscription'
      WHEN stripe_subscription_status = 'trialing' THEN 'trialing'
      WHEN stripe_subscription_status = 'active' THEN 'active'
      WHEN stripe_subscription_status = 'past_due' THEN 'past_due'
      WHEN stripe_subscription_status = 'canceled' THEN 'canceled'
      WHEN stripe_subscription_status = 'unpaid' THEN 'unpaid'
      ELSE stripe_subscription_status
    END
  ) STORED;

-- Indexes for webhook lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id ON users(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Batch Grading Sessions Table
CREATE TABLE IF NOT EXISTS batch_grading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grade_level VARCHAR(20) NOT NULL,
  subject VARCHAR(50) NOT NULL,
  rubric TEXT,
  standards_text TEXT,
  total_images INT NOT NULL DEFAULT 0,
  processed_count INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  results JSONB DEFAULT '[]'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_sessions_user ON batch_grading_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_sessions_status ON batch_grading_sessions(status);
CREATE INDEX IF NOT EXISTS idx_batch_sessions_created ON batch_grading_sessions(created_at DESC);


-- ============================================================
-- GOOGLE CLASSROOM INTEGRATION (append-only, never edit above)
-- ============================================================

-- Google Classroom OAuth tokens (per teacher)
CREATE TABLE IF NOT EXISTS google_classroom_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scope TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_gc_tokens_user ON google_classroom_tokens(user_id);

-- Synced Classroom courses
CREATE TABLE IF NOT EXISTS classroom_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gc_course_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  section VARCHAR(100),
  subject VARCHAR(100),
  room VARCHAR(100),
  owner_id VARCHAR(255),
  enrollment_code VARCHAR(50),
  course_state VARCHAR(50),
  alternate_link TEXT,
  guardian_enabled BOOLEAN DEFAULT FALSE,
  calendar_id VARCHAR(255),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, gc_course_id)
);

CREATE INDEX IF NOT EXISTS idx_gc_courses_user ON classroom_courses(user_id);
CREATE INDEX IF NOT EXISTS idx_gc_courses_gcid ON classroom_courses(gc_course_id);

-- Synced Classroom assignments (courseWork)
CREATE TABLE IF NOT EXISTS classroom_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES classroom_courses(id) ON DELETE CASCADE,
  gc_coursework_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  state VARCHAR(50),
  alternate_link TEXT,
  creation_time TIMESTAMP WITH TIME ZONE,
  update_time TIMESTAMP WITH TIME ZONE,
  due_date DATE,
  due_time TIME,
  max_points INTEGER,
  work_type VARCHAR(50),
  associated_with_developer BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(course_id, gc_coursework_id)
);

CREATE INDEX IF NOT EXISTS idx_gc_assignments_course ON classroom_assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_gc_assignments_gcid ON classroom_assignments(gc_coursework_id);

-- Student submissions from Classroom
CREATE TABLE IF NOT EXISTS classroom_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES classroom_assignments(id) ON DELETE CASCADE,
  gc_submission_id VARCHAR(255) NOT NULL,
  gc_user_id VARCHAR(255) NOT NULL,
  student_name VARCHAR(255),
  student_email VARCHAR(255),
  state VARCHAR(50),
  assigned_grade DECIMAL(6,2),
  draft_grade DECIMAL(6,2),
  late BOOLEAN DEFAULT FALSE,
  creation_time TIMESTAMP WITH TIME ZONE,
  update_time TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  grading_session_id UUID REFERENCES batch_grading_sessions(id) ON DELETE SET NULL,
  UNIQUE(assignment_id, gc_submission_id)
);

CREATE INDEX IF NOT EXISTS idx_gc_submissions_assignment ON classroom_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_gc_submissions_student ON classroom_submissions(gc_user_id);
CREATE INDEX IF NOT EXISTS idx_gc_submissions_session ON classroom_submissions(grading_session_id);

-- Sync log for debugging/monitoring
CREATE TABLE IF NOT EXISTS classroom_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  items_processed INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_gc_sync_log_user ON classroom_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_gc_sync_log_type ON classroom_sync_log(sync_type);