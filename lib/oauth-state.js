/**
 * OAuth State Store
 * 
 * Secure, expiring, session-bound state management for OAuth flows.
 * - State is stored server-side with hash (not in URL/cookie)
 * - Bound to user session (access token)
 * - Expires after 10 minutes
 * - Single-use (consumed on verification)
 * - Protects against CSRF/forgery
 * 
 * Works with both Google OAuth and Google Classroom OAuth
 */

import crypto from 'crypto';
import { getClient } from './db.js';

const STATE_EXPIRY_MINUTES = 10;
const STATE_BYTES = 32; // 256-bit state

function parseCookieHeader(header) {
  const values = {};
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try { values[name] = decodeURIComponent(value); } catch { values[name] = value; }
  }
  return values;
}

/**
 * Generate a cryptographically secure random state
 * @returns {string} URL-safe base64 state
 */
function generateState() {
  return crypto.randomBytes(STATE_BYTES).toString('base64url');
}

/**
 * Hash state for storage
 * @param {string} state - Plain state
 * @returns {string} SHA-256 hex hash
 */
function hashState(state) {
  return crypto.createHash('sha256').update(state).digest('hex');
}

/**
 * Check if state is expired
 * @param {Date} expiresAt - Expiry timestamp
 * @returns {boolean}
 */
function isExpired(expiresAt) {
  return new Date(expiresAt) < new Date();
}

/**
 * Store OAuth state bound to user session
 * 
 * @param {Object} params
 * @param {string} params.sessionId - Session ID from refresh token (or temp ID for pre-auth flows)
 * @param {Object} params.stateData - Arbitrary data to store (redirect, userId, etc.)
 * @param {string} params.provider - OAuth provider ('google' | 'classroom')
 * @param {Object} [params.client] - Optional DB client
 * @returns {Promise<{state: string, expiresAt: Date}>}
 */
export async function storeOAuthState({ sessionId, stateData, provider, client: externalClient = null }) {
  const state = generateState();
  const stateHash = hashState(state);
  const expiresAt = new Date(Date.now() + STATE_EXPIRY_MINUTES * 60 * 1000);
  
  const useClient = externalClient || await getClient();
  const shouldRelease = !externalClient;
  
  try {
    await useClient.query(
      `INSERT INTO oauth_states (session_id, state_hash, state_data, provider, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, stateHash, JSON.stringify(stateData), provider, expiresAt]
    );
    return { state, expiresAt };
  } finally {
    if (shouldRelease) useClient.release();
  }
}

/**
 * Verify and consume OAuth state atomically
 * Returns state data if valid, null if invalid/expired/used
 * Uses atomic UPDATE ... WHERE consumed_at IS NULL AND expires_at > NOW() RETURNING
 * to prevent race conditions.
 * 
 * @param {Object} params
 * @param {string} params.state - State from OAuth callback
 * @param {string} params.sessionId - Session ID to verify against
 * @param {string} params.provider - OAuth provider ('google' | 'classroom')
 * @param {Object} [params.client] - Optional DB client
 * @returns {Promise<Object | null>} State data or null
 */
export async function verifyAndConsumeOAuthState({ state, sessionId, provider, client: externalClient = null }) {
  // Reject missing/non-string/empty values before hashing/querying
  if (typeof state !== 'string' || state.length === 0) return null;
  if (typeof sessionId !== 'string' || sessionId.length === 0) return null;
  if (typeof provider !== 'string' || provider.length === 0) return null;

  const stateHash = hashState(state);
  
  const useClient = externalClient || await getClient();
  const shouldRelease = !externalClient;
  
  try {
    // Atomic verify-and-consume: only succeeds if state exists, is for this session+provider,
    // not yet consumed, and not expired
    const result = await useClient.query(
      `UPDATE oauth_states
         SET consumed_at = NOW()
       WHERE state_hash = $1
         AND session_id = $2
         AND provider = $3
         AND consumed_at IS NULL
         AND expires_at > NOW()
       RETURNING state_data`,
      [stateHash, sessionId, provider]
    );
    
    if (result.rows.length === 0) {
      return null; // Not found, already consumed, expired, or wrong session/provider
    }
    
    const data = result.rows[0].state_data;
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch {
    // DB failure - return null to prevent token exchange
    return null;
  } finally {
    if (shouldRelease) useClient.release();
  }
}

/**
 * Create a temporary session ID for pre-auth OAuth flows (e.g., Google sign-in before account exists)
 * Uses cryptographic randomness independent of client metadata
 * 
 * @param {Object} req - Express request object
 * @returns {string} Temporary session identifier
 */
export function createTempSessionId(req) {
  // Client metadata is predictable. Use fresh randomness so the cookie value
  // cannot be guessed from an OAuth callback URL or request headers.
  void req;
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Extract session ID from request (from access token cookie)
 * For authenticated flows (e.g., Classroom connect)
 * 
 * @param {Object} req - Express request object
 * @param {Function} verifyAccessToken - JWT verify function
 * @returns {string | null} Session ID or null
 */
export async function getSessionIdFromRequest(req, verifyAccessToken) {
  // Safely parse access_token cookie using shared cookie parser
  // Handles semicolon without space and invalid cookies gracefully
  const cookieHeader = req.headers?.cookie;
  if (typeof cookieHeader !== 'string' || !cookieHeader) return null;
  
  const cookies = parseCookieHeader(cookieHeader);
  const accessToken = cookies.access_token;
  
  if (!accessToken || typeof accessToken !== 'string') return null;
  
  try {
    const payload = verifyAccessToken(accessToken);
    if (!payload?.session_id) return null;
    return payload.session_id;
  } catch {
    // Invalid token format or verification failed
    return null;
  }
}

/**
 * Clean up expired/consumed OAuth states (maintenance)
 * @param {Object} [params.client] - Optional DB client
 * @returns {Promise<number>} Number of deleted states
 */
export async function cleanupExpiredOAuthStates({ client = null } = {}) {
  const useClient = client || await getClient();
  const shouldRelease = !client;
  
  try {
    const result = await useClient.query(
      `DELETE FROM oauth_states 
       WHERE expires_at < NOW() OR consumed_at IS NOT NULL`
    );
    return result.rowCount || 0;
  } finally {
    if (shouldRelease) useClient.release();
  }
}

/**
 * Set a short-lived HttpOnly SameSite=Lax cookie carrying an opaque temp session ID
 * Used for pre-auth OAuth flows (Google sign-in, Classroom connect)
 * 
 * @param {import('express').Response} res - Express response
 * @param {string} tempSessionId - Opaque session identifier
 */
export function setTempSessionCookie(res, tempSessionId) {
  res.cookie('temp_session_id', tempSessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60 * 1000, // 10 minutes (matches STATE_EXPIRY_MINUTES)
  });
}

/**
 * Read temp session ID cookie from request
 * @param {import('express').Request} req - Express request
 * @returns {string | null} Temp session ID or null
 */
export function getTempSessionCookie(req) {
  const cookieHeader = req.headers?.cookie;
  if (typeof cookieHeader !== 'string' || !cookieHeader) return null;
  
  const cookies = parseCookieHeader(cookieHeader);
  return cookies['temp_session_id'] || null;
}

/**
 * Clear temp session cookie
 * @param {import('express').Response} res - Express response
 */
export function clearTempSessionCookie(res) {
  res.cookie('temp_session_id', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
