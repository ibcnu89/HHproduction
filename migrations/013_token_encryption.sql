-- Add encrypted token columns to google_classroom_tokens
-- ============================================================
-- Run AFTER deploying token-encryption.js and setting ENCRYPTION_KEY

ALTER TABLE google_classroom_tokens
  ADD COLUMN IF NOT EXISTS access_token_enc JSONB,
  ADD COLUMN IF NOT EXISTS refresh_token_enc JSONB;

-- Index for encrypted token lookups (optional)
CREATE INDEX IF NOT EXISTS idx_google_classroom_tokens_enc ON google_classroom_tokens(user_id) WHERE access_token_enc IS NOT NULL;

-- Migration note:
-- 1. Deploy token-encryption.js
-- 2. Set ENCRYPTION_KEY in Railway env (generate with: openssl rand -hex 32)
-- 3. Run this migration
-- 4. Run migratePlaintextTokensToEncrypted() to migrate existing tokens
-- 5. After verification, drop plaintext columns:
--    ALTER TABLE google_classroom_tokens DROP COLUMN access_token, DROP COLUMN refresh_token;