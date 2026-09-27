/**
 * Auth middleware for protected API routes.
 *
 * requireAuth: reject unauthenticated requests with 401.
 * optionalAuth: attach user if token present, proceed either way.
 *
 * Token is read from the 'access_token' HttpOnly cookie set at login/register.
 *
 * Both functions can be used as:
 * 1. Express middleware: app.get('/route', requireAuth, handler)
 * 2. Helper in route handler: const user = requireAuth(req, res); if (!user) return;
 *
 * Returns user payload with both 'id' and 'sub' for compatibility.
 */

import { verifyAccessToken } from './jwt.js';
import { getCookie } from './cookies.js';

/**
 * Middleware that requires a valid access token.
 * Reads access_token cookie → verifies JWT → attaches req.user.
 * Calls next() if authenticated, sends 401 response if not.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {Function} next
 * @returns {void}
 *
 * Usage as middleware:
 *   app.get('/api/protected', requireAuth, (req, res) => { ... });
 *
 * Usage as helper:
 *   const user = requireAuth(req, res);
 *   if (!user) return;  // middleware already sent 401
 */
export function requireAuth(req, res, next) {
  const token = getCookie(req, 'access_token');

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  const payload = verifyAccessToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
    return;
  }

  // Attach user to request for downstream handlers
  // Include BOTH id and sub for compatibility with all handlers
  req.user = {
    id: payload.sub,
    sub: payload.sub,  // Classroom handlers expect req.user.sub
    email: payload.email,
    name: payload.name,
  };

  // If called as middleware (3 args), call next()
  if (typeof next === 'function') {
    next();
    return;
  }

  // If called as helper (2 args), return user
  return req.user;
}

/**
 * Middleware that optionally authenticates.
 * Reads access_token cookie → verifies JWT → attaches req.user if valid.
 * Always calls next() (never sends error response).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {Function} next
 * @returns {void}
 *
 * Usage:
 *   app.get('/api/optional', optionalAuth, (req, res) => { ... });
 *   // req.user may be set or undefined
 */
export function optionalAuth(req, res, next) {
  const token = getCookie(req, 'access_token');

  if (!token) {
    next();
    return;
  }

  const payload = verifyAccessToken(token);

  if (!payload) {
    next();
    return;
  }

  req.user = {
    id: payload.sub,
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
  };

  next();
}