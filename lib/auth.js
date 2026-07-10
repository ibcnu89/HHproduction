/**
 * Auth middleware for protected API routes.
 *
 * requireAuth: reject unauthenticated requests with 401.
 * optionalAuth: attach user if token present, proceed either way.
 *
 * Token is read from the 'access_token' HttpOnly cookie set at login/register.
 */

import { verifyAccessToken } from './jwt.js';
import { getCookie } from './cookies.js';

/**
 * Middleware that requires a valid access token.
 * Reads access_token cookie → verifies JWT → attaches req.user.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {Object|null} user payload if authenticated, null if not
 *
 * Usage:
 *   const user = requireAuth(req, res);
 *   if (!user) return;  // middleware already sent 401
 */
export function requireAuth(req, res) {
  const token = getCookie(req, 'access_token');

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return null;
  }

  const payload = verifyAccessToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
    return null;
  }

  // Attach user to request for downstream handlers
  req.user = {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
  };

  return req.user;
}

/**
 * Middleware that optionally authenticates.
 * Reads access_token cookie → verifies JWT → attaches req.user if valid.
 * Always returns (never sends error response).
 *
 * @param {import('http').IncomingMessage} req
 * @returns {Object|null} user payload if authenticated, null if not
 *
 * Usage:
 *   optionalAuth(req);
 *   // req.user may be set or undefined
 */
export function optionalAuth(req) {
  const token = getCookie(req, 'access_token');

  if (!token) return null;

  const payload = verifyAccessToken(token);

  if (!payload) return null;

  req.user = {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
  };

  return req.user;
}