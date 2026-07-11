/**
 * POST /api/auth/logout
 * Invalidate the current session and clear auth cookies.
 * 
 * Reads refresh_token cookie to identify the session.
 */

import { getClient } from '../../lib/db.js';
import { verifyRefreshToken } from '../../lib/jwt.js';
import { getCookie, clearAuthCookies } from '../../lib/cookies.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Clear cookies regardless — client always gets logged out
  clearAuthCookies(res);

  // Try to identify and invalidate the session
  const refreshToken = getCookie(req, 'refresh_token');
  if (!refreshToken) {
    return res.status(200).json({ success: true });
  }

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    return res.status(200).json({ success: true });
  }

  const client = await getClient();
  try {
    await client.query(
      'DELETE FROM sessions WHERE id = $1',
      [payload.session_id]
    );
  } catch (error) {
    console.error('Logout session cleanup error:', error);
    // Don't fail the request — cookies are already cleared
  } finally {
    client.release();
  }

  return res.status(200).json({ success: true });
}