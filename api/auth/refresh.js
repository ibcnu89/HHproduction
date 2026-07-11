/**
 * POST /api/auth/refresh
 * Rotate refresh token → issue new access token + new refresh token.
 * 
 * Reads refresh_token cookie, validates it, checks it matches DB hash,
 * then deletes old session + creates new one (rotation prevents replay).
 */

import { getClient } from '../../lib/db.js';
import { verifyRefreshToken, createAccessToken, createRefreshToken } from '../../lib/jwt.js';
import { setAccessTokenCookie, setRefreshTokenCookie, getCookie, clearAuthCookies } from '../../lib/cookies.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const oldRefreshToken = getCookie(req, 'refresh_token');
  if (!oldRefreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  // Verify the token
  const payload = verifyRefreshToken(oldRefreshToken);
  if (!payload) {
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const crypto = await import('crypto');
  const tokenHash = crypto.default.createHash('sha256').update(oldRefreshToken).digest('hex');

  const client = await getClient();

  try {
    // Find and validate the session
    const sessionResult = await client.query(
      `SELECT s.id, s.user_id, s.refresh_token_hash, s.expires_at, u.email, u.name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [payload.session_id]
    );

    const session = sessionResult.rows[0];

    // Session not found or refresh token hash doesn't match → possible replay attack
    if (!session || session.refresh_token_hash !== tokenHash) {
      // Delete all sessions for this user (defensive)
      await client.query('DELETE FROM sessions WHERE user_id = $1', [payload.sub]);
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Session invalid — possible token replay' });
    }

    // Check expiry
    if (new Date(session.expires_at) < new Date()) {
      await client.query('DELETE FROM sessions WHERE id = $1', [session.id]);
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Session expired' });
    }

    // Delete old session (rotation)
    await client.query('DELETE FROM sessions WHERE id = $1', [session.id]);

    // Create new session
    const newSession = await client.query(
      `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, expires_at)
       VALUES ($1, 'pending', $2, NOW() + INTERVAL '7 days')
       RETURNING id`,
      [session.user_id, req.headers['user-agent'] || null]
    );

    const newSessionId = newSession.rows[0].id;

    // Create new tokens
    const accessToken = createAccessToken({ id: session.user_id, email: session.email, name: session.name });
    const newRefreshToken = createRefreshToken(session.user_id, newSessionId);

    // Hash and store new refresh token
    const newTokenHash = crypto.default.createHash('sha256').update(newRefreshToken).digest('hex');
    await client.query(
      'UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2',
      [newTokenHash, newSessionId]
    );

    // Set new cookies
    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, newRefreshToken);

    return res.status(200).json({
      user: {
        id: session.user_id,
        email: session.email,
        name: session.name,
      },
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

