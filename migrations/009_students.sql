-- Students table for segregating student PII from teacher data
-- Only populated when teacher syncs from Google Classroom or manually adds students
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Google Classroom sync fields (only populated if synced)
  classroom_student_id VARCHAR(255), -- Google's internal ID
  classroom_course_id VARCHAR(255),
  name VARCHAR(255), -- Full name from Classroom
  email VARCHAR(255), -- Email from Classroom (optional)
  -- Local grading reference (if teacher adds manually)
  local_identifier VARCHAR(100), -- e.g., "Period 3, Seat 5"
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, -- Soft delete
  UNIQUE (teacher_id, classroom_student_id, classroom_course_id)
);

CREATE INDEX IF NOT EXISTS idx_students_teacher ON students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_classroom ON students(classroom_student_id, classroom_course_id);
-- Idempotent trigger creation: safe to replay on databases where this
-- trigger was already created outside the migration runner (legacy
-- deployments) — replaying must not abort the run before newer
-- migrations can apply.
DROP TRIGGER IF EXISTS update_students_updated_at ON students;
CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Link batch grading sessions to students
ALTER TABLE batch_grading_sessions 
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE SET NULL;

-- Create student_grading_results for individual question tracking
CREATE TABLE IF NOT EXISTS student_grading_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  batch_session_id UUID NOT NULL REFERENCES batch_grading_sessions(id) ON DELETE CASCADE,
  question_number INT NOT NULL,
  question_text TEXT,
  student_answer TEXT,
  is_correct BOOLEAN,
  points_earned DECIMAL(5,2),
  points_possible DECIMAL(5,2),
  feedback TEXT,
  graded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_results_student ON student_grading_results(student_id);
CREATE INDEX IF NOT EXISTS idx_student_results_batch ON student_grading_results(batch_session_id);