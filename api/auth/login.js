/**
 * POST /api/auth/login
 * Verify email + password credentials.
 * Returns user profile, sets access_token + refresh_token cookies.
 * 
 * Body: { email, password, remember_me? }
 */

import { getClient } from '../lib/db.js';
import { verifyPassword } from '../lib/password.js';
import { createAccessToken, createRefreshToken } from '../lib/jwt.js';
import { setAccessTokenCookie, setRefreshTokenCookie } from '../lib/cookies.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, remember_me } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const emailTrimmed = email.trim().toLowerCase();
  const client = await getClient();

  try {
    // Find user by email
    const result = await client.query(
      'SELECT id, email, password_hash, name, avatar_url, created_at FROM users WHERE email = $1',
      [emailTrimmed]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Google-only users have no password_hash
    if (!user.password_hash) {
      return res.status(401).json({
        error: 'This account uses Google sign-in. Please log in with Google.',
      });
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create session
    const sessionResult = await client.query(
      `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, expires_at)
       VALUES ($1, 'pending', $2, NOW() + INTERVAL '7 days')
       RETURNING id`,
      [user.id, req.headers['user-agent'] || null]
    );

    const sessionId = sessionResult.rows[0].id;

    // Create tokens
    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user.id, sessionId, !!remember_me);

    // Hash and store refresh token
    const crypto = await import('crypto');
    const tokenHash = crypto.default.createHash('sha256').update(refreshToken).digest('hex');

    await client.query(
      'UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2',
      [tokenHash, sessionId]
    );

    // Set cookies
    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken, !!remember_me);

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}