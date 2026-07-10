/**
 * POST /api/auth/change-password
 * Change password while logged in. Requires current password + new password.
 * Protected by auth cookie (requireAuth).
 *
 * Body: { current_password, new_password }
 * Returns: { message }
 */

import { getClient } from '../../lib/db.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../../lib/password.js';
import { requireAuth } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = requireAuth(req, res);
  if (!user) return;

  const { current_password, new_password } = req.body || {};

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  // Prevent reuse of same password
  if (current_password === new_password) {
    return res.status(400).json({ error: 'New password must be different from current password' });
  }

  const pwCheck = validatePasswordStrength(new_password);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.message });
  }

  const client = await getClient();

  try {
    // Get current password hash
    const result = await client.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [user.id]
    );

    const dbUser = result.rows[0];

    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!dbUser.password_hash) {
      return res.status(400).json({
        error: 'This account uses Google sign-in and does not have a password. Set a password first via the reset flow.',
      });
    }

    // Verify current password
    const valid = await verifyPassword(current_password, dbUser.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Set new password
    const newHash = await hashPassword(new_password);
    await client.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, user.id]
    );

    return res.status(200).json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}