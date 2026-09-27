-- Password Reset Tokens Table
-- Stores hashed, single-use, expiring password reset tokens
-- Supports secure email-based password reset flow

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,       -- SHA-256 hash of the reset token
  email VARCHAR(255) NOT NULL,            -- Email the token was sent to (for verification)
  purpose VARCHAR(50) NOT NULL DEFAULT 'password_reset',  -- Token purpose (extensible)
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,       -- NULL = unused, set when consumed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);

-- Ensure single active reset token per user (optional constraint - can have multiple pending but only one unused)
-- ALTER TABLE password_reset_tokens ADD CONSTRAINT unique_active_reset_token_per_user 
--   EXCLUDE (user_id WITH =) WHERE (used_at IS NULL);