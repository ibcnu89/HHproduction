/**
 * POST /api/auth/forgot-password
 * Generate a password reset token for the given email.
 * In MVP: returns the token directly (no email).
 * In production: add email sending infra.
 *
 * Body: { email }
 * Returns: { message, reset_token? }
 */

import { getClient } from '../../lib/db.js';
import { createAccessToken } from '../../lib/jwt.js';

// Override expiry for reset tokens: 1 hour
import jwt from 'jsonwebtoken';

function createResetToken(userId, email) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ sub: userId, email, purpose: 'password_reset' }, secret, { expiresIn: '1h' });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const emailTrimmed = email.trim().toLowerCase();
  const client = await getClient();

  try {
    const result = await client.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [emailTrimmed]
    );

    const user = result.rows[0];

    // Don't reveal whether the email exists (security best practice).
    // But we need a valid user to generate a token.
    if (!user) {
      return res.status(200).json({
        message: 'If an account with that email exists, a reset link has been generated.',
      });
    }

    if (!user.password_hash) {
      return res.status(200).json({
        message: 'This account uses Google sign-in and does not have a password to reset.',
      });
    }

    const resetToken = createResetToken(user.id, user.email);

    return res.status(200).json({
      message: 'Password reset token generated. Use this token with /api/auth/reset-password.',
      reset_token: resetToken,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}