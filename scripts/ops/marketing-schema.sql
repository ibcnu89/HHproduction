-- Marketing Operations Tables for HHproduction
-- Run: psql $DATABASE_URL -f /home/ibcnu/HHproduction-workdir/scripts/ops/marketing-schema.sql

-- Outreach Prospects
CREATE TABLE IF NOT EXISTS outreach_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  subject VARCHAR(100), -- what they teach
  school VARCHAR(200),
  district VARCHAR(200),
  state VARCHAR(2) DEFAULT 'IL',
  source VARCHAR(50), -- 'reddit', 'facebook', 'linkedin', 'conference', 'referral'
  source_url TEXT,
  status VARCHAR(20) DEFAULT 'new', -- 'new', 'contacted', 'replied', 'interested', 'unsubscribed', 'bounced'
  touch_count INT DEFAULT 0,
  last_contacted TIMESTAMPTZ,
  next_followup TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_prospects(status);
CREATE INDEX IF NOT EXISTS idx_outreach_next_followup ON outreach_prospects(next_followup);

-- Scheduled Content
CREATE TABLE IF NOT EXISTS scheduled_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(300) NOT NULL,
  content_type VARCHAR(50) NOT NULL, -- 'blog', 'twitter_thread', 'linkedin_post', 'reddit_post', 'newsletter'
  text TEXT NOT NULL,
  platforms JSONB NOT NULL DEFAULT '[]', -- ['twitter', 'linkedin', 'reddit', 'blog', 'newsletter']
  subreddit VARCHAR(100), -- for reddit posts
  media_urls JSONB DEFAULT '[]', -- image/video URLs
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'scheduled', 'published', 'failed'
  publish_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  error TEXT,
  meta JSONB DEFAULT '{}', -- SEO keywords, hashtags, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_publish ON scheduled_content(status, publish_at);

-- MRR Snapshots
CREATE TABLE IF NOT EXISTS mrr_snapshots (
  date DATE PRIMARY KEY,
  mrr_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
  active_subscriptions INT NOT NULL DEFAULT 0,
  trialing_subscriptions INT NOT NULL DEFAULT 0,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Marketing Spend Tracking
CREATE TABLE IF NOT EXISTS marketing_spend (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  platform VARCHAR(50) NOT NULL, -- 'google_ads', 'meta_ads', 'linkedin_ads', 'content', 'outreach'
  campaign VARCHAR(200),
  spend_usd DECIMAL(10,2) NOT NULL,
  impressions INT,
  clicks INT,
  conversions INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_daily ON marketing_spend(date, platform, campaign);

-- Content Performance Tracking
CREATE TABLE IF NOT EXISTS content_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES scheduled_content(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  likes INT DEFAULT 0,
  shares INT DEFAULT 0,
  comments INT DEFAULT 0,
  profile_visits INT DEFAULT 0,
  signups_attributed INT DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_perf_content ON content_performance(content_id);

-- Outreach Email Templates
CREATE TABLE IF NOT EXISTS outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  subject VARCHAR(300) NOT NULL,
  html TEXT NOT NULL,
  text TEXT NOT NULL,
  variables JSONB DEFAULT '[]', -- ['first_name', 'subject', 'school']
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default outreach templates
INSERT INTO outreach_templates (name, subject, html, text, variables) VALUES
(
  'teacher_cold_v1',
  'Quick question about your grading workload',
  '<p>Hi {{first_name}},</p><p>I noticed you teach {{subject}} at {{school}} — respect. That''s a lot of papers.</p><p>I built an AI tool that grades handwritten homework against state standards in seconds. Teachers using it cut grading time by ~80%.</p><p>Free 7-day trial, no commitment. Want me to send a 60-second demo video?</p><p>— Skyler<br>HomeworkHelper</p>',
  'Hi {{first_name}},\n\nI noticed you teach {{subject}} at {{school}} — respect. That''s a lot of papers.\n\nI built an AI tool that grades handwritten homework against state standards in seconds. Teachers using it cut grading time by ~80%.\n\nFree 7-day trial, no commitment. Want me to send a 60-second demo video?\n\n— Skyler\nHomeworkHelper',
  '["first_name", "subject", "school"]'
),
(
  'teacher_cold_v2',
  'Your Tuesday night grading pile',
  '<p>Hi {{first_name}},</p><p>Tuesday night. Stack of {{subject}} papers. Netflix waiting.</p><p>What if you could snap a photo of each paper and get standards-aligned grades + feedback in 30 seconds?</p><p>That''s what HomeworkHelper does. Illinois Learning Standards, custom rubrics, handwriting OCR.</p><p>7-day free trial. Cancel anytime. <a href="https://hhproduction-production.up.railway.app">Try it here</a>.</p><p>— Skyler</p>',
  'Hi {{first_name}},\n\nTuesday night. Stack of {{subject}} papers. Netflix waiting.\n\nWhat if you could snap a photo of each paper and get standards-aligned grades + feedback in 30 seconds?\n\nThat''s what HomeworkHelper does. Illinois Learning Standards, custom rubrics, handwriting OCR.\n\n7-day free trial. Cancel anytime. https://hhproduction-production.up.railway.app\n\n— Skyler',
  '["first_name", "subject"]'
)
ON CONFLICT (name) DO NOTHING;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_outreach_prospects_updated_at ON outreach_prospects;
CREATE TRIGGER update_outreach_prospects_updated_at
  BEFORE UPDATE ON outreach_prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scheduled_content_updated_at ON scheduled_content;
CREATE TRIGGER update_scheduled_content_updated_at
  BEFORE UPDATE ON scheduled_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_outreach_templates_updated_at ON outreach_templates;
CREATE TRIGGER update_outreach_templates_updated_at
  BEFORE UPDATE ON outreach_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();