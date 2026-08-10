-- Add refresh token rotation support
-- ============================================================
-- family_id tracks token families for rotation/reuse detection
-- replaced_by tracks which session replaced this one (for audit)

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS family_id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS replaced_by UUID REFERENCES sessions(id),
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS revoked_reason VARCHAR(100);

-- Index for family lookups
CREATE INDEX IF NOT EXISTS idx_sessions_family ON sessions(family_id);
CREATE INDEX IF NOT EXISTS idx_sessions_revoked ON sessions(revoked_at) WHERE revoked_at IS NOT NULL;

-- Function to rotate refresh token (invalidate old, create new in same family)
-- ============================================================
CREATE OR REPLACE FUNCTION rotate_refresh_token(
  p_old_session_id UUID,
  p_new_session_id UUID,
  p_user_agent TEXT
) RETURNS VOID AS $$
BEGIN
  -- Mark old session as revoked and link to new one
  UPDATE sessions 
  SET revoked_at = NOW(),
      revoked_reason = 'rotated',
      replaced_by = p_new_session_id
  WHERE id = p_old_session_id;
  
  -- Update new session with same family_id
  UPDATE sessions
  SET family_id = (SELECT family_id FROM sessions WHERE id = p_old_session_id)
  WHERE id = p_new_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to detect token reuse and revoke entire family
-- ============================================================
CREATE OR REPLACE FUNCTION revoke_token_family(
  p_session_id UUID,
  p_reason VARCHAR(100)
) RETURNS VOID AS $$
DECLARE
  v_family_id UUID;
BEGIN
  SELECT family_id INTO v_family_id FROM sessions WHERE id = p_session_id;
  
  IF v_family_id IS NOT NULL THEN
    UPDATE sessions
    SET revoked_at = NOW(),
        revoked_reason = p_reason
    WHERE family_id = v_family_id
      AND revoked_at IS NULL;
  END IF;
END;
$$ LANGUAGE plpgsql;