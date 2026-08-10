-- Retention configuration (configurable per deployment)
CREATE TABLE IF NOT EXISTS retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type VARCHAR(50) NOT NULL UNIQUE, -- 'grading_images', 'batch_results', 'classroom_sync_logs', 'audit_logs'
  retention_days INT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert defaults
INSERT INTO retention_policies (resource_type, retention_days, description) VALUES
  ('grading_images', 30, 'Uploaded homework images purged after grading'),
  ('batch_results', 365, 'Batch grading results retained for 1 year'),
  ('classroom_sync_logs', 90, 'Classroom sync audit trail'),
  ('audit_logs', 365, 'Security audit log retention'),
  ('grading_results', 730, 'Individual grading results retained 2 years')
ON CONFLICT (resource_type) DO NOTHING;

-- Add deleted_at for soft delete tracking
ALTER TABLE batch_grading_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;