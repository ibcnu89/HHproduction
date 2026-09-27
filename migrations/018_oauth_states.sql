-- OAuth States Table
-- Stores expiring, single-use, session-bound OAuth state tokens
-- Protects against CSRF/forgery in OAuth flows

CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,       -- Session ID (from refresh token) or temp ID
  state_hash VARCHAR(255) NOT NULL,       -- SHA-256 hash of the state parameter
  state_data JSONB NOT NULL,              -- Arbitrary data (redirect, userId, etc.)
  provider VARCHAR(50) NOT NULL,          -- 'google' | 'classroom'
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  consumed_at TIMESTAMP WITH TIME ZONE,   -- NULL = unused, set when consumed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_session ON oauth_states(session_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_states_state_hash ON oauth_states(state_hash);
CREATE INDEX IF NOT EXISTS idx_oauth_states_provider ON oauth_states(provider);