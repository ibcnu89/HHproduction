/**
 * POST /api/auth/unlink-google
 * Remove Google OAuth link from current account.
 * Only works if the user also has a password set (can't unlink
 * if Google is the only login method).
 *
 * Protected by auth cookie (requireAuth).
 *
 * Returns: { message }
 */

import { getClient } from '../../lib/db.js';
import { requireAuth } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = requireAuth(req, res);
  if (!user) return;

  const client = await getClient();

  try {
    const result = await client.query(
      'SELECT google_id, password_hash FROM users WHERE id = $1',
      [user.id]
    );

    const dbUser = result.rows[0];

    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!dbUser.google_id) {
      return res.status(400).json({ error: 'Your account is not linked to Google.' });
    }

    if (!dbUser.password_hash) {
      return res.status(400).json({
        error: 'Cannot unlink Google — you have no password set. Please set a password first in Account Settings, then unlink Google.',
      });
    }

    await client.query(
      'UPDATE users SET google_id = NULL, updated_at = NOW() WHERE id = $1',
      [user.id]
    );

    return res.status(200).json({ message: 'Google account unlinked. You can now only sign in with email/password.' });
  } catch (error) {
    console.error('Unlink Google error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}