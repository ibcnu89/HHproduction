/**
 * POST /api/auth/reset-password
 * Accept a reset token + new password. Sets the new password hash.
 *
 * Body: { token, new_password }
 * Returns: { message }
 */

import { getClient } from '../../lib/db.js';
import { hashPassword, validatePasswordStrength } from '../../lib/password.js';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, new_password } = req.body || {};

  if (!token || !new_password) {
    return res.status(400).json({ error: 'Reset token and new password are required' });
  }

  // Verify the reset token
  let payload;
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');
    payload = jwt.verify(token, secret);

    if (payload.purpose !== 'password_reset') {
      return res.status(400).json({ error: 'Invalid reset token' });
    }
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
    }
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  // Validate new password strength
  const pwCheck = validatePasswordStrength(new_password);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.message });
  }

  const client = await getClient();

  try {
    const newHash = await hashPassword(new_password);

    const result = await client.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [newHash, payload.sub]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'User not found. The account may have been deleted.' });
    }

    return res.status(200).json({
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}