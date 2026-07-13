/**
 * Railway Express Server — HHproduction
 *
 * Replaces Vercel serverless functions with a single Express process.
 * Railway runs: node server.js
 *
 * Architecture:
 *   - API routes (/api/*) → Express route handlers
 *   - Static SPA (/*) → serve dist/ folder, SPA fallback to index.html
 *   - CORS: handled via Railway's edge proxy (X-Forwarded-Host)
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getClient } from './lib/db.js';
import {
  verifyPassword,
  hashPassword,
  validatePasswordStrength,
} from './lib/password.js';
import {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './lib/jwt.js';
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  getCookie,
  clearAuthCookies,
} from './lib/cookies.js';
import { requireAuth } from './lib/auth.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';

// ── Helpers ──────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect domain from Railway env or fall back
const RAILWAY_PUBLIC_DOMAIN = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_SERVICE_HHPRODUCTION_URL || 'localhost';
const FRONTEND_URL = `https://${RAILWAY_PUBLIC_DOMAIN}`;
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const REDIRECT_URI = `${FRONTEND_URL}/api/auth/google/callback`;

function createResetToken(userId, email) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign(
    { sub: userId, email, purpose: 'password_reset' },
    secret,
    { expiresIn: '1h' }
  );
}

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
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await client.query(
    'UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2',
    [hash, sessionId]
  );
}

function issueCookies(res, user, sessionId, rememberMe) {
  const accessToken = createAccessToken(user);
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

// ── Standards data loader ────────────────────────────────────────────

const STANDARDS_DATA_PATH = path.join(__dirname, 'api', '_standards_data.json');
let standardsCache = null;

function loadStandards() {
  if (standardsCache) return standardsCache;
  try {
    const data = fs.readFileSync(STANDARDS_DATA_PATH, 'utf8');
    standardsCache = JSON.parse(data);
    return standardsCache;
  } catch (e) {
    console.error('Failed to load standards data:', e.message);
    return null;
  }
}

function normalizeGradeLevel(gradeLevel) {
  const map = {
    'k': 'K', 'kindergarten': 'K',
    '1': '1st', '1st': '1st', 'first': '1st',
    '2': '2nd', '2nd': '2nd', 'second': '2nd',
    '3': '3rd', '3rd': '3rd', 'third': '3rd',
    '4': '4th', '4th': '4th', 'fourth': '4th',
    '5': '5th', '5th': '5th', 'fifth': '5th',
    '6': '6th', '6th': '6th', 'sixth': '6th',
    '7': '7th', '7th': '7th', 'seventh': '7th',
    '8': '8th', '8th': '8th', 'eighth': '8th',
    '9': '9th', '9th': '9th', 'ninth': '9th',
    '10': '10th', '10th': '10th', 'tenth': '10th',
    '11': '11th', '11th': '11th', 'eleventh': '11th',
    '12': '12th', '12th': '12th', 'twelfth': '12th',
  };
  const key = gradeLevel.toLowerCase().trim();
  return map[key] || gradeLevel;
}

function formatStandardsText(subject, gradeLevel, standards) {
  if (!standards || standards.length === 0) return null;
  let text = `Illinois Learning Standards for ${subject} ${gradeLevel} Grade:\n\n`;
  standards.forEach((s, i) => {
    text += `${i + 1}. ${s.code}: ${s.description}\n`;
  });
  return text;
}

// ── Gemini Grading Helpers ───────────────────────────────────────────

function getStrictnessGuidance(gradeLevel) {
  const gradeNum =
    gradeLevel === 'K' ? 0 : parseInt(gradeLevel.replace(/st|nd|rd|th/, ''), 10);

  if (gradeNum <= 2) {
    return `STRICTNESS: GENTLE (Grades K-2)\n- Focus on effort and conceptual understanding over mechanical correctness\n- Spelling/grammar errors are expected — do not penalize heavily\n- Handwriting legibility issues are normal — grade what you can decipher\n- Partial credit generously for showing any reasoning or attempt\n- Encouragement should dominate feedback (3:1 positive to constructive ratio)`;
  } else if (gradeNum <= 5) {
    return `STRICTNESS: MODERATE (Grades 3-5)\n- Basic spelling of grade-appropriate words should be correct (sight words, common vocabulary)\n- Capitalization and end punctuation expected consistently\n- Math: calculation errors penalized, but credit for correct setup/process\n- Writing: paragraph structure, topic sentences expected\n- Science/Other: accurate terminology for concepts taught at this level\n- Feedback balanced: acknowledge effort, note specific areas to improve`;
  } else if (gradeNum <= 8) {
    return `STRICTNESS: FIRM (Grades 6-8)\n- Spelling/grammar: minimal errors expected; common words must be correct\n- Math: calculation accuracy required; partial credit only for clear process with minor arithmetic slip\n- Writing: thesis, evidence, transitions, conclusion structure required\n- Science: precise vocabulary, correct units, logical reasoning\n- Multi-step problems: all steps must be shown and logically connected\n- Feedback direct: clearly identify errors and what mastery looks like`;
  } else if (gradeNum <= 10) {
    return `STRICTNESS: HIGH (Grades 9-10)\n- Near-professional mechanics: spelling, grammar, punctuation nearly flawless\n- Math: precision required; correct setup with arithmetic error = minor deduction\n- Writing: sophisticated structure, varied syntax, strong evidence integration\n- Science: technical accuracy, proper notation, justified conclusions\n- Analysis over recall: synthesis, evaluation, original thinking rewarded\n- Feedback specific and standards-referenced; "good effort" insufficient`;
  } else {
    return `STRICTNESS: VERY HIGH / COLLEGE-READY (Grades 11-12)\n- Mechanics essentially perfect; errors indicate lack of proofreading\n- Math: rigorous notation, complete logical chain, exact answers expected\n- Writing: college-level argumentation, nuance, counter-argument handling\n- Science/Other: disciplinary conventions, citations, uncertainty acknowledgment\n- Independent insight, critical analysis, and synthesis required for top scores\n- Feedback evaluative: measures against external standards (AP, IB, college rubrics)\n- Grade inflation actively avoided — A range reserved for exceptional work`;
  }
}

function buildAutoRubricInstructions(gradeLevel, subject, standardsText) {
  const standardsBlock = standardsText
    ? `\nSTANDARDS REFERENCE (use these as your rubric backbone — the auto-generated correct answers and point values MUST be defensible against these standards):\n${standardsText}\n`
    : `\nNo standards were loaded. Fall back to general ${subject} norms for grade ${gradeLevel}.\n`;

  return `RUBRIC MODE: AUTO-GENERATED (no teacher answer key provided)\n\nFor each question in the student's submission, you must:\n1. Infer the most likely correct answer using:\n   - The question text from OCR\n   - Grade ${gradeLevel} ${subject} expectations\n   - The standards reference below\n2. Assign points_possible using these per-question heuristics:\n   - Multiple-choice / single number / short fill-in: 1 point\n   - Multi-step math / short constructed response: 2-3 points\n   - Multi-part question (e.g. "2a, 2b, 2c"): list each sub-part; each sub-part 1-2 points\n   - Extended response / short essay (3+ sentences expected): 4-5 points\n3. When a question is ambiguous or under-specified, prefer the simpler answer typical of grade-level classroom work. Bias toward allowing partial credit.\n${standardsBlock}\nIn your JSON output, populate "correct_answer" with the inferred answer (so the teacher can review it). Set "points_possible" per the heuristics above. Set "is_correct" and "points_earned" based on how the student's answer compares to the inferred correct answer.`;
}

function buildAnswerKeyRubricInstructions() {
  return `RUBRIC MODE: TEACHER-PROVIDED ANSWER KEY\n\nA teacher has supplied an answer key / rubric. Treat it as authoritative for "correct_answer" and "points_possible" per question. Where the key lists grading notes (partial credit, required elements), honor them.`;
}

// ── Express App ──────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '10mb' })); // support base64 image uploads

// ── Auth Routes (/api/auth/*) ────────────────────────────────────────

app.get('/api/auth/me', async (req, res) => {
  const accessToken = getCookie(req, 'access_token');
  if (!accessToken) return res.status(401).json({ error: 'Not authenticated' });

  const payload = verifyAccessToken(accessToken);
  if (!payload)
    return res
      .status(401)
      .json({ error: 'Token expired or invalid', code: 'TOKEN_EXPIRED' });

  return res.status(200).json({
    user: { id: payload.sub, email: payload.email, name: payload.name },
  });
});

app.get('/api/auth/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID)
    return res.status(500).json({ error: 'Google OAuth is not configured' });

  const appRedirect = req.query.redirect || '/';
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state: Buffer.from(JSON.stringify({ redirect: appRedirect })).toString(
      'base64'
    ),
  });

  return res.redirect(
    302,
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
});

app.get('/api/auth/google/callback', async (req, res) => {
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const { code, state, error: googleError } = req.query;

  if (googleError) {
    return res.redirect(
      302,
      `${FRONTEND_URL}/?auth_error=${encodeURIComponent(googleError)}`
    );
  }
  if (!code)
    return res.status(400).json({ error: 'Missing authorization code' });
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET)
    return res.status(500).json({ error: 'Google OAuth is not configured' });

  try {
    // 1. Exchange code for tokens
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

    const { id_token } = tokens;
    if (!id_token)
      return res.redirect(302, `${FRONTEND_URL}/?auth_error=no_id_token`);

    // 2. Decode ID token
    const idParts = id_token.split('.');
    if (idParts.length !== 3)
      return res.redirect(302, `${FRONTEND_URL}/?auth_error=invalid_id_token`);

    const payload = JSON.parse(
      Buffer.from(
        idParts[1].replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
      ).toString('utf8')
    );

    const googleId = payload.sub;
    const email = payload.email?.toLowerCase();
    const name = payload.name || null;
    const avatarUrl = payload.picture || null;

    if (!googleId || !email)
      return res.redirect(302, `${FRONTEND_URL}/?auth_error=missing_user_info`);

    // 3. Lookup or create user
    const client = await getClient();
    try {
      const existingGoogle = await client.query(
        'SELECT id, email, name, avatar_url FROM users WHERE google_id = $1',
        [googleId]
      );

      let user;
      if (existingGoogle.rows.length > 0) {
        user = existingGoogle.rows[0];
        if (avatarUrl && avatarUrl !== user.avatar_url) {
          await client.query(
            'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2',
            [avatarUrl, user.id]
          );
          user.avatar_url = avatarUrl;
        }
      } else {
        const existingEmail = await client.query(
          'SELECT id, google_id FROM users WHERE email = $1',
          [email]
        );

        if (existingEmail.rows.length > 0) {
          const existing = existingEmail.rows[0];
          if (existing.google_id) {
            return res.redirect(302, `${FRONTEND_URL}/?auth_error=email_conflict`);
          }
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
          const result = await client.query(
            `INSERT INTO users (email, google_id, name, avatar_url, email_verified)
             VALUES ($1, $2, $3, $4, TRUE)
             RETURNING id, email, name, avatar_url`,
            [email, googleId, name, avatarUrl]
          );
          user = result.rows[0];
        }
      }

      // 4. Create session + tokens
      const sessionResult = await client.query(
        `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, expires_at)
         VALUES ($1, 'pending', $2, NOW() + INTERVAL '7 days')
         RETURNING id`,
        [user.id, req.headers['user-agent'] || null]
      );
      const sessionId = sessionResult.rows[0].id;

      const accessToken = createAccessToken(user);
      const refreshToken = createRefreshToken(user.id, sessionId);

      const tokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');
      await client.query(
        'UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2',
        [tokenHash, sessionId]
      );

      setAccessTokenCookie(res, accessToken);
      setRefreshTokenCookie(res, refreshToken);

      // 5. Redirect to frontend
      let appRedirect = '/';
      if (state) {
        try {
          const stateData = JSON.parse(
            Buffer.from(
              state.replace(/-/g, '+').replace(/_/g, '/'),
              'base64'
            ).toString('utf8')
          );
          if (stateData.redirect) appRedirect = stateData.redirect;
        } catch { /* invalid state, default to / */ }
      }

      return res.redirect(302, `${FRONTEND_URL}${appRedirect}`);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Google callback error:', error);
    return res.redirect(302, `${FRONTEND_URL}/?auth_error=internal_error`);
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password, remember_me } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const emailTrimmed = email.trim().toLowerCase();
  const client = await getClient();
  try {
    const result = await client.query(
      'SELECT id, email, password_hash, name, avatar_url, created_at FROM users WHERE email = $1',
      [emailTrimmed]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.password_hash)
      return res
        .status(401)
        .json({
          error:
            'This account uses Google sign-in. Please log in with Google.',
        });

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Invalid email or password' });

    const sessionId = await makeSession(
      client,
      user.id,
      req.headers['user-agent']
    );
    const refreshToken = issueCookies(res, user, sessionId, !!remember_me);
    await storeRefreshHash(client, sessionId, refreshToken);

    return res.status(200).json({ user: userResponse(user) });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const emailTrimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed))
    return res.status(400).json({ error: 'Invalid email format' });

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
          error:
            'This email is already registered via Google. Please sign in with Google instead.',
          code: 'google_linked',
        });
      }
      return res.status(409).json({
        error:
          'An account with this email already exists. Please sign in or reset your password.',
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

    const sessionId = await makeSession(
      client,
      user.id,
      req.headers['user-agent']
    );
    const refreshToken = issueCookies(res, user, sessionId, false);
    await storeRefreshHash(client, sessionId, refreshToken);

    return res.status(201).json({ user: userResponse(user) });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/logout', async (req, res) => {
  clearAuthCookies(res);
  const refreshToken = getCookie(req, 'refresh_token');
  if (!refreshToken) return res.status(200).json({ success: true });

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) return res.status(200).json({ success: true });

  const client = await getClient();
  try {
    await client.query('DELETE FROM sessions WHERE id = $1', [
      payload.session_id,
    ]);
  } catch (error) {
    console.error('Logout session cleanup error:', error);
  } finally {
    client.release();
  }
  return res.status(200).json({ success: true });
});

app.post('/api/auth/refresh', async (req, res) => {
  const oldRefreshToken = getCookie(req, 'refresh_token');
  if (!oldRefreshToken)
    return res.status(401).json({ error: 'No refresh token' });

  const payload = verifyRefreshToken(oldRefreshToken);
  if (!payload) {
    clearAuthCookies(res);
    return res
      .status(401)
      .json({ error: 'Invalid or expired refresh token' });
  }

  const tokenHash = crypto
    .createHash('sha256')
    .update(oldRefreshToken)
    .digest('hex');
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
      await client.query('DELETE FROM sessions WHERE user_id = $1', [
        payload.sub,
      ]);
      clearAuthCookies(res);
      return res
        .status(401)
        .json({ error: 'Session invalid — possible token replay' });
    }
    if (new Date(session.expires_at) < new Date()) {
      await client.query('DELETE FROM sessions WHERE id = $1', [
        session.id,
      ]);
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

    const user = {
      id: session.user_id,
      email: session.email,
      name: session.name,
    };
    const newRefreshToken = issueCookies(res, user, newSessionId, false);
    const newHash = crypto
      .createHash('sha256')
      .update(newRefreshToken)
      .digest('hex');
    await client.query(
      'UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2',
      [newHash, newSessionId]
    );

    return res.status(200).json({
      user: { id: session.user_id, email: session.email, name: session.name },
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const emailTrimmed = email.trim().toLowerCase();
  const client = await getClient();
  try {
    const result = await client.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [emailTrimmed]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(200).json({
        message:
          'If an account with that email exists, a reset link has been generated.',
      });
    }
    if (!user.password_hash) {
      return res.status(200).json({
        message:
          'This account uses Google sign-in and does not have a password to reset.',
      });
    }

    const resetToken = createResetToken(user.id, user.email);
    return res.status(200).json({
      message:
        'Password reset token generated. Use this token with /api/auth/reset-password.',
      reset_token: resetToken,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, new_password } = req.body || {};
  if (!token || !new_password)
    return res
      .status(400)
      .json({ error: 'Reset token and new password are required' });

  let payload;
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');
    payload = jwt.verify(token, secret);
    if (payload.purpose !== 'password_reset')
      return res.status(400).json({ error: 'Invalid reset token' });
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(400).json({
        error: 'Reset token has expired. Please request a new one.',
      });
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const pwCheck = validatePasswordStrength(new_password);
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.message });

  const client = await getClient();
  try {
    const newHash = await hashPassword(new_password);
    const result = await client.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [newHash, payload.sub]
    );
    if (result.rowCount === 0)
      return res.status(400).json({
        error: 'User not found. The account may have been deleted.',
      });
    return res.status(200).json({
      message:
        'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password)
    return res
      .status(400)
      .json({ error: 'Current password and new password are required' });
  if (current_password === new_password)
    return res
      .status(400)
      .json({ error: 'New password must be different from current password' });

  const pwCheck = validatePasswordStrength(new_password);
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.message });

  const client = await getClient();
  try {
    const result = await client.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [user.id]
    );
    const dbUser = result.rows[0];
    if (!dbUser) return res.status(404).json({ error: 'User not found' });
    if (!dbUser.password_hash) {
      return res.status(400).json({
        error:
          'This account uses Google sign-in and does not have a password. Set a password first via the reset flow.',
      });
    }

    const valid = await verifyPassword(current_password, dbUser.password_hash);
    if (!valid)
      return res
        .status(401)
        .json({ error: 'Current password is incorrect' });

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
});

app.post('/api/auth/unlink-google', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const client = await getClient();
  try {
    const result = await client.query(
      'SELECT google_id, password_hash FROM users WHERE id = $1',
      [user.id]
    );
    const dbUser = result.rows[0];
    if (!dbUser) return res.status(404).json({ error: 'User not found' });
    if (!dbUser.google_id)
      return res
        .status(400)
        .json({ error: 'Your account is not linked to Google.' });
    if (!dbUser.password_hash) {
      return res.status(400).json({
        error:
          'Cannot unlink Google — you have no password set. Please set a password first in Account Settings, then unlink Google.',
      });
    }

    await client.query(
      'UPDATE users SET google_id = NULL, updated_at = NOW() WHERE id = $1',
      [user.id]
    );
    return res.status(200).json({
      message:
        'Google account unlinked. You can now only sign in with email/password.',
    });
  } catch (error) {
    console.error('Unlink Google error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── Grading Endpoints ─────────────────────────────────────────────────

app.post('/api/extract', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { imageBase64, mimeType, gradeLevel, subject, standardsText } =
    req.body;
  if (!imageBase64 || !mimeType || !gradeLevel || !subject) {
    return res.status(400).json({
      error:
        'Missing required fields: imageBase64, mimeType, gradeLevel, subject',
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    return res
      .status(500)
      .json({ error: 'Gemini API key not configured on server' });

  let prompt =
    "You are reading a child's handwritten homework. Grade level: " +
    gradeLevel +
    '. Subject: ' +
    subject +
    ".\n\nTranscribe every question and the child's handwritten answer exactly as written, preserving question numbers and structure. If an answer is blank, note it as [blank].\n\n";

  if (standardsText) {
    prompt +=
      'Use the following Illinois Learning Standards as your baseline reference when proposing correct answers and point values:\n' +
      standardsText +
      '\n\n';
  }

  prompt +=
    'Return ONLY a JSON array where each item has:\n{\n  "question_number": "string (e.g., \\"1\\", \\"2a\\", \\"Q3\\")",\n  "question_text": "string - the full question text as visible",\n  "student_answer": "string - exactly what the student wrote"\n}';

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

  try {
    const parts = [
      { text: prompt },
      { inline_data: { mime_type: mimeType, data: imageBase64 } },
    ];

    let response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('Empty response from Gemini API');

    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
      // Retry once
      const retryParts = [
        { text: prompt + '\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation.' },
        parts[1],
      ];
      response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: retryParts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API retry error: ${response.status} - ${errText}`);
      }
      const retryData = await response.json();
      const retryText =
        retryData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!retryText)
        throw new Error('Empty response from Gemini API on retry');
      parsed = JSON.parse(
        retryText.replace(/```json\n?|\n?```/g, '').trim()
      );
    }

    if (!Array.isArray(parsed))
      throw new Error('Expected JSON array response from Gemini');

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Extract handwriting error:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/extract-rubric', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { imageBase64, mimeType } = req.body;
  if (!imageBase64 || !mimeType)
    return res
      .status(400)
      .json({ error: 'Missing required fields: imageBase64, mimeType' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    return res
      .status(500)
      .json({ error: 'Gemini API key not configured on server' });

  const prompt =
    "You are reading a teacher's answer key / rubric document. Transcribe it into a structured rubric.\n\nReturn ONLY a JSON array where each item has:\n{\n  \"question_number\": \"string (e.g., \\\"1\\\", \\\"2a\\\", \\\"Q3\\\")\",\n  \"correct_answer\": \"string - the correct answer or expected response\",\n  \"points_possible\": \"number - maximum points for this question\"\n}\n\nInclude all questions found. If points are not explicitly listed, estimate based on complexity (1-5 points typical).";

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

  try {
    const parts = [
      { text: prompt },
      { inline_data: { mime_type: mimeType, data: imageBase64 } },
    ];

    let response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('Empty response from Gemini API');

    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
      const retryParts = [
        {
          text:
            prompt +
            '\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation.',
        },
        parts[1],
      ];
      response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: retryParts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(
          `Gemini API retry error: ${response.status} - ${errText}`
        );
      }
      const retryData = await response.json();
      const retryText =
        retryData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!retryText)
        throw new Error('Empty response from Gemini API on retry');
      parsed = JSON.parse(
        retryText.replace(/```json\n?|\n?```/g, '').trim()
      );
    }

    if (!Array.isArray(parsed))
      throw new Error('Expected JSON array response from Gemini');

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Extract rubric error:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/grade', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { extractedQuestions, rubric, standardsText, gradeLevel, subject } =
    req.body;

  if (!extractedQuestions || !gradeLevel || !subject)
    return res.status(400).json({
      error:
        'Missing required fields: extractedQuestions, gradeLevel, subject',
    });
  if (!Array.isArray(extractedQuestions))
    return res
      .status(400)
      .json({ error: 'extractedQuestions must be an array' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    return res
      .status(500)
      .json({ error: 'Gemini API key not configured on server' });

  const hasRubric =
    typeof rubric === 'string' && rubric.trim().length > 0;
  const rubricModeBlock = hasRubric
    ? buildAnswerKeyRubricInstructions()
    : buildAutoRubricInstructions(gradeLevel, subject, standardsText);
  const rubricSection = hasRubric
    ? `\nTeacher's answer key / rubric (authoritative):\n${rubric}\n`
    : `\nNo teacher answer key provided. ${standardsText ? 'Generate the rubric from the standards reference above.' : 'Generate the rubric from subject + grade-level norms.'}\n`;

  const prompt = `You are a kind, encouraging teacher. Grade level: ${gradeLevel}. Subject: ${subject}.\n\nStudent's answers (from OCR of handwritten homework):\n${JSON.stringify(extractedQuestions, null, 2)}\n${rubricSection}\n\n${rubricModeBlock}\n\n${getStrictnessGuidance(gradeLevel)}\n\nReturn ONLY a JSON object with this exact structure:\n{\n  "rubric_mode": "${hasRubric ? 'teacher_key' : 'auto_generated'}",\n  "questions": [\n    {\n      "question_number": "string",\n      "question_text": "string (echo the OCR'd question text verbatim)",\n      "student_answer": "string",\n      "correct_answer": "string",\n      "is_correct": true,\n      "points_earned": number,\n      "points_possible": number,\n      "feedback": "string - one encouraging sentence explaining what was right or what to work on"\n    }\n  ],\n  "overall": {\n    "total_points_earned": number,\n    "total_points_possible": number,\n    "letter_grade": "string (A+, A, A-, B+, B, B-, C+, C, C-, D, F)",\n    "encouragement_message": "string - warm, encouraging message for the student"\n  }\n}`;

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

  try {
    let response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('Empty response from Gemini API');

    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
      const retryPrompt = `${prompt}\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation.`;
      response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: retryPrompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(
          `Gemini API retry error: ${response.status} - ${errText}`
        );
      }
      const retryData = await response.json();
      const retryText =
        retryData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!retryText)
        throw new Error('Empty response from Gemini API on retry');
      parsed = JSON.parse(
        retryText.replace(/```json\n?|\n?```/g, '').trim()
      );
    }

    if (
      !parsed.questions ||
      !Array.isArray(parsed.questions) ||
      !parsed.overall
    )
      throw new Error('Invalid response structure from Gemini API');

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Grade submission error:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/get-standard', (req, res) => {
  const { gradeLevel, subject } = req.body;
  if (!gradeLevel || !subject)
    return res
      .status(400)
      .json({ error: 'Missing required fields: gradeLevel, subject' });

  const data = loadStandards();
  if (!data)
    return res
      .status(500)
      .json({ standardsText: null, error: 'Standards data not available' });

  const normGrade = normalizeGradeLevel(gradeLevel);
  const subjectData = data[subject];

  if (!subjectData)
    return res.status(200).json({
      standardsText: null,
      error: `Subject "${subject}" not found in standards data`,
    });

  const standards = subjectData[normGrade];
  if (!standards || standards.length === 0)
    return res.status(200).json({
      standardsText: null,
      error: `No standards found for ${subject} ${normGrade}`,
    });

  const standardsText = formatStandardsText(subject, normGrade, standards);
  return res.status(200).json({
    standardsText,
    error: null,
    gradeLevel: normGrade,
    subject,
    count: standards.length,
  });
});

// ── Health check ──────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Static SPA — catch-all fallback to index.html ─────────────────────

const DIST_DIR = path.join(__dirname, 'dist');
app.use(express.static(DIST_DIR));

// Express 5: use app.use() for catch-all, not app.get('*')
app.use((req, res) => {
  // Only serve index.html for non-API routes that don't match static files
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// ── Startup ───────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT, 10) || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`HHproduction server running on port ${PORT}`);
  console.log(`Public URL: ${FRONTEND_URL}`);
  console.log(`Cookie domain: ${COOKIE_DOMAIN || '(none)'}`);
});