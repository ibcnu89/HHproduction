/**
 * GET /api/auth/google/callback
 * Handle Google's OAuth 2.0 callback after user consents.
 * 
 * Google calls this with ?code=...&state=...
 * 
 * Flow:
 * 1. Exchange code for Google tokens (access_token + id_token)
 * 2. Decode id_token to get Google user info (sub, email, name, picture)
 * 3. Lookup or create user account
 * 4. Issue JWT tokens, set cookies, redirect to app
 */

import { getClient } from '../../../lib/db.js';
import { createAccessToken, createRefreshToken } from '../../../lib/jwt.js';
import { setAccessTokenCookie, setRefreshTokenCookie } from '../../../lib/cookies.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// Use GOOGLE_REDIRECT_URI from env (set in Railway) or derive from FRONTEND_URL
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL}/api/auth/google/callback`;
const FRONTEND_URL = process.env.FRONTEND_URL || `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, error: googleError } = req.query;

  // Google returned an error (user denied consent, etc.)
  if (googleError) {
    return res.redirect(302, `${FRONTEND_URL}/?auth_error=${encodeURIComponent(googleError)}`);
  }

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Google OAuth is not configured' });
  }

  try {
    // 1. Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    // Get the response text first, then try to parse
    const tokenText = await tokenResponse.text();

    if (!tokenResponse.ok) {
      console.error('Google token exchange failed:', tokenText);
      return res.redirect(302, `${FRONTEND_URL}/?auth_error=token_exchange_failed`);
    }

    let tokens;
    try {
      tokens = JSON.parse(tokenText);
    } catch {
      return res.redirect(302, `${FRONTEND_URL}/?auth_error=token_exchange_failed`);
    }
    const { id_token, access_token: googleAccessToken } = tokens;

    if (!id_token) {
      return res.redirect(302, `${FRONTEND_URL}/?auth_error=no_id_token`);
    }

    // 2. Decode the ID token to get user info (no network call needed — it's a JWT)
    // The id_token is a JWT signed by Google. We can decode the payload without verifying
    // the signature since we just received it directly from Google's token endpoint over HTTPS.
    const idParts = id_token.split('.');
    if (idParts.length !== 3) {
      return res.redirect(302, `${FRONTEND_URL}/?auth_error=invalid_id_token`);
    }

    const payload = JSON.parse(
    Buffer.from(idParts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  );

    const googleId = payload.sub;
    const email = payload.email?.toLowerCase();
    const name = payload.name || null;
    const avatarUrl = payload.picture || null;
    const emailVerified = payload.email_verified === true;

    if (!googleId || !email) {
      return res.redirect(302, `${FRONTEND_URL}/?auth_error=missing_user_info`);
    }

    // 3. Lookup or create user account
    const client = await getClient();

    try {
      // Check if this Google ID already exists
      const existingGoogle = await client.query(
        'SELECT id, email, name, avatar_url FROM users WHERE google_id = $1',
        [googleId]
      );

      let user;

      if (existingGoogle.rows.length > 0) {
        // Existing Google user — just log them in
        user = existingGoogle.rows[0];

        // Update avatar if changed
        if (avatarUrl && avatarUrl !== user.avatar_url) {
          await client.query('UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2', [
            avatarUrl,
            user.id,
          ]);
          user.avatar_url = avatarUrl;
        }
      } else {
        // Check if email already exists (email/password user who hasn't linked Google)
        const existingEmail = await client.query(
          'SELECT id, google_id FROM users WHERE email = $1',
          [email]
        );

        if (existingEmail.rows.length > 0) {
          const existing = existingEmail.rows[0];

          if (existing.google_id) {
            // Email exists AND has a different Google ID — shouldn't happen normally
            return res.redirect(302, `${FRONTEND_URL}/?auth_error=email_conflict`);
          }

          // Link Google ID to existing email/password account
          await client.query(
            'UPDATE users SET google_id = $1, email_verified = TRUE, avatar_url = COALESCE($2, avatar_url), name = COALESCE($3, name), updated_at = NOW() WHERE id = $4',
            [googleId, avatarUrl, name, existing.id]
          );

          user = {
            id: existing.id,
            email,
            name: name || null,
            avatar_url: avatarUrl,
          };
        } else {
          // Brand new user — create account
          const result = await client.query(
            `INSERT INTO users (email, google_id, name, avatar_url, email_verified)
             VALUES ($1, $2, $3, $4, TRUE)
             RETURNING id, email, name, avatar_url`,
            [email, googleId, name, avatarUrl]
          );
          user = result.rows[0];
        }
      }

      // 4. Create session and issue JWT tokens
      const sessionResult = await client.query(
        `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, expires_at)
         VALUES ($1, 'pending', $2, NOW() + INTERVAL '7 days')
         RETURNING id`,
        [user.id, req.headers['user-agent'] || null]
      );

      const sessionId = sessionResult.rows[0].id;

      const accessToken = createAccessToken(user);
      const refreshToken = createRefreshToken(user.id, sessionId);

      // Hash and store refresh token
      const crypto = await import('crypto');
      const tokenHash = crypto.default.createHash('sha256').update(refreshToken).digest('hex');
      await client.query('UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2', [
        tokenHash,
        sessionId,
      ]);

      // Set cookies
      setAccessTokenCookie(res, accessToken);
      setRefreshTokenCookie(res, refreshToken);

      // 5. Redirect to frontend
      let appRedirect = '/';
      if (state) {
        try {
          const stateData = JSON.parse(
            Buffer.from(state.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
          );
          if (stateData.redirect) {
            appRedirect = stateData.redirect;
          }
        } catch {
          // Invalid state — default to /
        }
      }

      return res.redirect(302, `${FRONTEND_URL}${appRedirect}`);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Google callback error:', error);
    return res.redirect(302, `${FRONTEND_URL}/?auth_error=internal_error`);
  }
}