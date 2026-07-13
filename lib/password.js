/**
 * Password hashing + verification using bcryptjs.
 * Cost factor 12 — good balance of security and serverless latency.
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password.
 * Returns the bcrypt hash string (60 chars, includes salt).
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a bcrypt hash.
 * Returns boolean — true if password matches.
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Basic server-side password strength validation.
 * Returns { valid: boolean, message: string }
 */
export function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  if (password.length > 128) {
    return { valid: false, message: 'Password must be under 128 characters' };
  }
  // At least one letter and one number
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one letter and one number' };
  }
  return { valid: true, message: null };
}

/**
 * Hash a value with SHA-256 (for IP/user-agent hashing in session table).
 */
export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}