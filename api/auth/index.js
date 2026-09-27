/**
 * /api/auth/* — Unified auth route handler.
 *
 * Vercel Hobby plan caps serverless functions at 12. This single file
 * replaces 10 separate auth endpoint files by routing on request path.
 *
 * Routes:
 *   GET  /api/auth/me               — current user profile
 *   GET  /api/auth/google            — redirect to Google OAuth
 *   POST /api/auth/login             — email/password login
 *   POST /api/auth/register          — create account
 *   POST /api/auth/logout            — clear session
 *   POST /api/auth/refresh           — rotate tokens
 *   POST /api/auth/forgot-password   — generate reset token
 *   POST /api/auth/reset-password    — apply password reset
 *   POST /api/auth/change-password   — change while logged in
 *   POST /api/auth/unlink-google     — remove Google link
 */

import { getClient } from '../../lib/db.js';
import { verifyPassword, hashPassword, validatePasswordStrength } from '../../lib/password.js';
import {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../lib/jwt.js';
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  getCookie,
  clearAuthCookies,
} from '../../lib/cookies.js';
import { requireAuth } from '../../lib/auth.js';
import { requestPasswordReset, completePasswordReset } from '../../lib/password-reset.js';

// ── Helpers ──────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
// Use GOOGLE_REDIRECT_URI from env (set in Railway) or derive from FRONTEND_URL
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL}/api/auth/google/callback`;

async function makeSession(client, userId, userAgent) {
  const r = await client.query(
    `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, expires_at)
     VALUES ($1, 'pending', $2, NOW() + INTERVAL '7 days')
     RETURNING id`,
    [userId, userAgent || null]
  );
  return r.rows[0].id;
}

async function storeRefreshHash(client, sessionId, refreshToken) {
  const crypto = await import('crypto');
  const hash = crypto.default.createHash('sha256').update(refreshToken).digest('hex');
  await client.query('UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2', [hash, sessionId]);
}

function issueCookies(res, user, sessionId, rememberMe) {
  const accessToken = createAccessToken(user, sessionId);
  const refreshToken = createRefreshToken(user.id, sessionId, !!rememberMe);
  setAccessTokenCookie(res, accessToken);
  setRefreshTokenCookie(res, refreshToken, !!rememberMe);
  return refreshToken;
}

function userResponse(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
  };
}

// ── Route handlers ────────────────────────────────────────────────────

/** GET /api/auth/me */
async function handleMe(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const accessToken = getCookie(req, 'access_token');
  if (!accessToken) return res.status(401).json({ error: 'Not authenticated' });

  const payload = verifyAccessToken(accessToken);
  if (!payload) return res.status(401).json({ error: 'Token expired or invalid', code: 'TOKEN_EXPIRED' });

  return res.status(200).json({
    user: { id: payload.sub, email: payload.email, name: payload.name },
  });
}

/** GET /api/auth/google */
async function handleGoogle(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!GOOGLE_CLIENT_ID) return res.status(500).json({ error: 'Google OAuth is not configured' });

  const appRedirect = req.query.redirect || '/';
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state: Buffer.from(JSON.stringify({ redirect: appRedirect })).toString('base64'),
  });

  return res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

/** POST /api/auth/login */
async function handleLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, remember_me } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const emailTrimmed = email.trim().toLowerCase();
  const client = await getClient();
  try {
    const result = await client.query(
      'SELECT id, email, password_hash, name, avatar_url, created_at FROM users WHERE email = $1',
      [emailTrimmed]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.password_hash) {
      return res.status(401).json({ error: 'This account uses Google sign-in. Please log in with Google.' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const sessionId = await makeSession(client, user.id, req.headers['user-agent']);
    const refreshToken = issueCookies(res, user, sessionId, !!remember_me);
    await storeRefreshHash(client, sessionId, refreshToken);

    return res.status(200).json({ user: userResponse(user) });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

/** POST /api/auth/register */
async function handleRegister(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const emailTrimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const pwCheck = validatePasswordStrength(password);
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.message });

  const client = await getClient();
  try {
    const existing = await client.query(
      'SELECT id, google_id FROM users WHERE email = $1',
      [emailTrimmed]
    );
    if (existing.rows.length > 0) {
      const eu = existing.rows[0];
      if (eu.google_id) {
        return res.status(409).json({
          error: 'This email is already registered via Google. Please sign in with Google instead.',
          code: 'google_linked',
        });
      }
      return res.status(409).json({
        error: 'An account with this email already exists. Please sign in or reset your password.',
        code: 'email_exists',
      });
    }

    const passwordHash = await hashPassword(password);
    const result = await client.query(
      `INSERT INTO users (email, password_hash, name, email_verified)
       VALUES ($1, $2, $3, FALSE)
       RETURNING id, email, name, avatar_url, created_at`,
      [emailTrimmed, passwordHash, name?.trim() || null]
    );
    const user = result.rows[0];

    const sessionId = await makeSession(client, user.id, req.headers['user-agent']);
    const refreshToken = issueCookies(res, user, sessionId, false);
    await storeRefreshHash(client, sessionId, refreshToken);

    return res.status(201).json({ user: userResponse(user) });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

/** POST /api/auth/logout */
async function handleLogout(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  clearAuthCookies(res);
  const refreshToken = getCookie(req, 'refresh_token');
  if (!refreshToken) return res.status(200).json({ success: true });

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) return res.status(200).json({ success: true });

  const client = await getClient();
  try {
    await client.query('DELETE FROM sessions WHERE id = $1', [payload.session_id]);
  } catch (error) {
    console.error('Logout session cleanup error:', error);
  } finally {
    client.release();
  }
  return res.status(200).json({ success: true });
}

/** POST /api/auth/refresh */
async function handleRefresh(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const oldRefreshToken = getCookie(req, 'refresh_token');
  if (!oldRefreshToken) return res.status(401).json({ error: 'No refresh token' });

  const payload = verifyRefreshToken(oldRefreshToken);
  if (!payload) {
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const crypto = await import('crypto');
  const tokenHash = crypto.default.createHash('sha256').update(oldRefreshToken).digest('hex');
  const client = await getClient();

  try {
    const sessionResult = await client.query(
      `SELECT s.id, s.user_id, s.refresh_token_hash, s.expires_at, u.email, u.name
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [payload.session_id]
    );
    const session = sessionResult.rows[0];

    if (!session || session.refresh_token_hash !== tokenHash) {
      await client.query('DELETE FROM sessions WHERE user_id = $1', [payload.sub]);
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Session invalid — possible token replay' });
    }
    if (new Date(session.expires_at) < new Date()) {
      await client.query('DELETE FROM sessions WHERE id = $1', [session.id]);
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Session expired' });
    }

    await client.query('DELETE FROM sessions WHERE id = $1', [session.id]);
    const newSession = await client.query(
      `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, expires_at)
       VALUES ($1, 'pending', $2, NOW() + INTERVAL '7 days')
       RETURNING id`,
      [session.user_id, req.headers['user-agent'] || null]
    );
    const newSessionId = newSession.rows[0].id;

    const user = { id: session.user_id, email: session.email, name: session.name };
    const newRefreshToken = issueCookies(res, user, newSessionId, false);
    const newHash = crypto.default.createHash('sha256').update(newRefreshToken).digest('hex');
    await client.query('UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2', [newHash, newSessionId]);

    return res.status(200).json({ user: { id: session.user_id, email: session.email, name: session.name } });
  } catch (error) {
    console.error('Refresh error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

/** POST /api/auth/forgot-password */
async function handleForgotPassword(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const result = await requestPasswordReset({ email });
    return res.status(200).json({ message: result.message });
  } catch (error) {
    console.error('Forgot password failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** POST /api/auth/reset-password */
async function handleResetPassword(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, email, new_password } = req.body || {};
  if (!token || !email || !new_password) return res.status(400).json({ error: 'Reset token, email, and new password are required' });

  const pwCheck = validatePasswordStrength(new_password);
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.message });

  try {
    const result = await completePasswordReset({ token, email, newPassword: new_password });
    if (!result.success) return res.status(400).json({ error: result.message, code: result.error });
    return res.status(200).json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
  } catch (error) {
    console.error('Reset password failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** POST /api/auth/change-password */
async function handleChangePassword(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireAuth(req, res);
  if (!user) return;

  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) return res.status(400).json({ error: 'Current password and new password are required' });
  if (current_password === new_password) return res.status(400).json({ error: 'New password must be different from current password' });

  const pwCheck = validatePasswordStrength(new_password);
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.message });

  const client = await getClient();
  try {
    const result = await client.query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
    const dbUser = result.rows[0];
    if (!dbUser) return res.status(404).json({ error: 'User not found' });
    if (!dbUser.password_hash) {
      return res.status(400).json({ error: 'This account uses Google sign-in and does not have a password. Set a password first via the reset flow.' });
    }

    const valid = await verifyPassword(current_password, dbUser.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const newHash = await hashPassword(new_password);
    await client.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, user.id]);
    return res.status(200).json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

/** POST /api/auth/unlink-google */
async function handleUnlinkGoogle(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireAuth(req, res);
  if (!user) return;

  const client = await getClient();
  try {
    const result = await client.query('SELECT google_id, password_hash FROM users WHERE id = $1', [user.id]);
    const dbUser = result.rows[0];
    if (!dbUser) return res.status(404).json({ error: 'User not found' });
    if (!dbUser.google_id) return res.status(400).json({ error: 'Your account is not linked to Google.' });
    if (!dbUser.password_hash) {
      return res.status(400).json({ error: 'Cannot unlink Google — you have no password set. Please set a password first in Account Settings, then unlink Google.' });
    }

    await client.query('UPDATE users SET google_id = NULL, updated_at = NOW() WHERE id = $1', [user.id]);
    return res.status(200).json({ message: 'Google account unlinked. You can now only sign in with email/password.' });
  } catch (error) {
    console.error('Unlink Google error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

// ── Router ────────────────────────────────────────────────────────────

const routes = {
  'me':               { method: 'GET',  handler: handleMe },
  'google':           { method: 'GET',  handler: handleGoogle },
  'login':            { method: 'POST', handler: handleLogin },
  'register':         { method: 'POST', handler: handleRegister },
  'logout':           { method: 'POST', handler: handleLogout },
  'refresh':          { method: 'POST', handler: handleRefresh },
  'forgot-password':  { method: 'POST', handler: handleForgotPassword },
  'reset-password':   { method: 'POST', handler: handleResetPassword },
  'change-password':  { method: 'POST', handler: handleChangePassword },
  'unlink-google':    { method: 'POST', handler: handleUnlinkGoogle },
};

export default async function handler(req, res) {
  // Parse the route from the URL path: /api/auth/XXX → route = 'XXX'
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathParts = url.pathname.replace(/^\/api\/auth\/?/, '').split('/').filter(Boolean);
  const route = pathParts[0]; // e.g. 'login', 'me', 'forgot-password', etc.

  const entry = routes[route];
  if (!entry) {
    return res.status(404).json({ error: `Unknown auth route: /api/auth/${route || ''}` });
  }

  // Optional: validate HTTP method matches expected
  if (req.method !== entry.method && req.method !== 'OPTIONS') {
    return res.status(405).json({ error: `Method ${req.method} not allowed for /api/auth/${route}. Use ${entry.method}.` });
  }

  return entry.handler(req, res);
}
