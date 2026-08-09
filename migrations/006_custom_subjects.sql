CREATE TABLE IF NOT EXISTS user_custom_subjects (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_name VARCHAR(100) NOT NULL,
    subject_code VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, subject_name)
);

CREATE INDEX IF NOT EXISTS idx_user_custom_subjects_user_id ON user_custom_subjects(user_id);