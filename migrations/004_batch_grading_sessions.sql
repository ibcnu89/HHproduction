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

-- Updated_at trigger
CREATE TRIGGER update_batch_grading_sessions_updated_at
  BEFORE UPDATE ON batch_grading_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
