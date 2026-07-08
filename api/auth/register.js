/**
 * POST /api/auth/register
 * Create a new account with email + password.
 * Returns user profile, sets access_token + refresh_token cookies.
 * 
 * Body: { email, password, name? }
 */

import { getClient } from '../lib/db.js';
import { hashPassword, validatePasswordStrength } from '../lib/password.js';
import { createAccessToken, createRefreshToken } from '../lib/jwt.js';
import { setAccessTokenCookie, setRefreshTokenCookie } from '../lib/cookies.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, name } = req.body || {};

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Basic email format check
  const emailTrimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Password strength
  const pwCheck = validatePasswordStrength(password);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.message });
  }

  const client = await getClient();

  try {
    // Check if email already exists
    const existing = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [emailTrimmed]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const result = await client.query(
      `INSERT INTO users (email, password_hash, name, email_verified)
       VALUES ($1, $2, $3, FALSE)
       RETURNING id, email, name, avatar_url, created_at`,
      [emailTrimmed, passwordHash, name?.trim() || null]
    );

    const user = result.rows[0];

    // Create session for refresh token
    const sessionResult = await client.query(
      `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, expires_at)
       VALUES ($1, 'pending', $2, NOW() + INTERVAL '7 days')
       RETURNING id`,
      [user.id, req.headers['user-agent'] || null]
    );

    const sessionId = sessionResult.rows[0].id;

    // Create tokens
    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user.id, sessionId);

    // Store refresh token hash in session
    const crypto = await import('crypto');
    const tokenHash = crypto.default.createHash('sha256').update(refreshToken).digest('hex');

    await client.query(
      'UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2',
      [tokenHash, sessionId]
    );

    // Set cookies
    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);

    return res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}