/**
 * GET /api/auth/me
 * Validate the access token cookie and return the current user profile.
 * Used by the frontend to check auth state on page load / refresh.
 */

import { verifyAccessToken } from '../../lib/jwt.js';
import { getCookie } from '../../lib/cookies.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = getCookie(req, 'access_token');
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const payload = verifyAccessToken(accessToken);
  if (!payload) {
    return res.status(401).json({ error: 'Token expired or invalid', code: 'TOKEN_EXPIRED' });
  }

  return res.status(200).json({
    user: {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
    },
  });
}