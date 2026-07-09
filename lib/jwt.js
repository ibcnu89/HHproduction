/**
 * JWT token creation and verification.
 * 
 * Token strategy:
 * - Access token: 15 min expiry, contains { sub (user_id), email, name }
 * - Refresh token: 7 day expiry, contains { sub, session_id }
 */

import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REMEMBER_ME_EXPIRY = '30d';

/**
 * Get JWT signing secrets from environment.
 * Throws if not configured (prevents silent failures in prod).
 */
function getSecrets() {
  const accessSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!accessSecret || !refreshSecret) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be configured');
  }

  return { accessSecret, refreshSecret };
}

/**
 * Create an access token (short-lived, used for API auth).
 * @param {Object} user — { id, email, name }
 * @returns {string} signed JWT
 */
export function createAccessToken(user) {
  const { accessSecret } = getSecrets();
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name || null,
    },
    accessSecret,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Create a refresh token (long-lived, used to rotate access tokens).
 * @param {string} userId — UUID
 * @param {string} sessionId — UUID of the sessions row
 * @param {boolean} rememberMe — extends expiry to 30 days
 * @returns {string} signed JWT
 */
export function createRefreshToken(userId, sessionId, rememberMe = false) {
  const { refreshSecret } = getSecrets();
  return jwt.sign(
    {
      sub: userId,
      session_id: sessionId,
    },
    refreshSecret,
    { expiresIn: rememberMe ? REMEMBER_ME_EXPIRY : REFRESH_TOKEN_EXPIRY }
  );
}

/**
 * Verify an access token. Returns payload or null.
 */
export function verifyAccessToken(token) {
  try {
    const { accessSecret } = getSecrets();
    return jwt.verify(token, accessSecret);
  } catch {
    return null;
  }
}

/**
 * Verify a refresh token. Returns payload or null.
 */
export function verifyRefreshToken(token) {
  try {
    const { refreshSecret } = getSecrets();
    return jwt.verify(token, refreshSecret);
  } catch {
    return null;
  }
}