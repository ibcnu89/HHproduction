/**
 * Token Encryption Utilities
 * AES-256-GCM encryption for Google OAuth tokens at rest
 * Uses ENCRYPTION_KEY from environment (32 bytes = 64 hex chars)
 */

import crypto from 'crypto';

// Get encryption key from environment
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY not configured. Generate with: openssl rand -hex 32');
  }
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * @param {string} plaintext - String to encrypt
 * @returns {Object} { encrypted: base64, iv: base64, authTag: base64 }
 */
export function encryptToken(plaintext) {
  if (!plaintext) return null;
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypt an encrypted token
 * @param {Object} encryptedData - { encrypted, iv, authTag } all base64
 * @returns {string|null} Decrypted plaintext or null if invalid
 */
export function decryptToken(encryptedData) {
  if (!encryptedData || !encryptedData.encrypted) return null;
  
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    const encrypted = Buffer.from(encryptedData.encrypted, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Token decryption failed:', err.message);
    return null;
  }
}

/**
 * Encrypt tokens object for storage
 * @param {Object} tokens - { access_token, refresh_token, expiry_date, scope }
 * @returns {Object} Encrypted tokens ready for DB storage
 */
export function encryptTokensForStorage(tokens) {
  if (!tokens) return null;
  
  const result = {};
  
  if (tokens.access_token) {
    result.access_token_enc = encryptToken(tokens.access_token);
  }
  if (tokens.refresh_token) {
    result.refresh_token_enc = encryptToken(tokens.refresh_token);
  }
  if (tokens.expiry_date) {
    result.expires_at = new Date(tokens.expiry_date);
  }
  if (tokens.scope) {
    result.scope = tokens.scope;
  }
  
  return result;
}

/**
 * Decrypt tokens from storage
 * @param {Object} row - Database row with encrypted fields
 * @returns {Object} Decrypted tokens for API use
 */
export function decryptTokensFromStorage(row) {
  if (!row) return null;
  
  const tokens = {};
  
  if (row.access_token_enc) {
    tokens.access_token = decryptToken(row.access_token_enc);
  }
  if (row.refresh_token_enc) {
    tokens.refresh_token = decryptToken(row.refresh_token_enc);
  }
  if (row.expires_at) {
    tokens.expiry_date = new Date(row.expires_at).getTime();
  }
  if (row.scope) {
    tokens.scope = row.scope;
  }
  
  return tokens;
}

/**
 * Migrate existing plaintext tokens to encrypted storage
 * Run once after deploying encryption
 */
export async function migratePlaintextTokensToEncrypted() {
  const { getClient } = await import('./db.js');
  const client = await getClient();
  
  try {
    const result = await client.query(
      `SELECT user_id, access_token, refresh_token, expires_at, scope
       FROM google_classroom_tokens
       WHERE access_token_enc IS NULL AND access_token IS NOT NULL`
    );
    
    console.log(`Found ${result.rows.length} plaintext token records to migrate`);
    
    for (const row of result.rows) {
      const encrypted = encryptTokensForStorage({
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        expiry_date: row.expires_at?.getTime(),
        scope: row.scope,
      });
      
      await client.query(
        `UPDATE google_classroom_tokens
         SET access_token_enc = $1, refresh_token_enc = $2, updated_at = NOW()
         WHERE user_id = $3`,
        [JSON.stringify(encrypted.access_token_enc), JSON.stringify(encrypted.refresh_token_enc), row.user_id]
      );
      
      console.log(`Migrated tokens for user ${row.user_id}`);
    }
    
    console.log('Token migration complete');
  } finally {
    client.release();
  }
}

export default {
  encryptToken,
  decryptToken,
  encryptTokensForStorage,
  decryptTokensFromStorage,
  migratePlaintextTokensToEncrypted,
};