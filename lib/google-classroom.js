/**
 * Google Classroom API Client
 * Handles OAuth, token management, and API calls
 */

import { google } from 'googleapis';
import { getClient } from './db.js';
import crypto from 'crypto';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.FRONTEND_URL}/api/classroom/callback`
);

const CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails',
  'https://www.googleapis.com/auth/classroom.profile.photos',
].join(' ');

export function getClassroomAuthUrl(state = {}) {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: CLASSROOM_SCOPES,
    prompt: 'consent',
    state: Buffer.from(JSON.stringify(state)).toString('base64'),
  });
}

export async function exchangeClassroomCode(code) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens; // { access_token, refresh_token, expiry_date, scope }
}

export async function getValidClassroomTokens(userId) {
  const client = await getClient();
  try {
    const result = await client.query(
      `SELECT access_token, refresh_token, expires_at 
       FROM google_classroom_tokens 
       WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) return null;

    const { access_token, refresh_token, expires_at } = result.rows[0];
    
    // Refresh if expires within 5 minutes
    if (new Date(expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
      return await refreshClassroomTokens(userId, refresh_token);
    }
    return { access_token };
  } finally {
    client.release();
  }
}

export async function refreshClassroomTokens(userId, refreshToken) {
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  
  const client = await getClient();
  try {
    await client.query(
      `UPDATE google_classroom_tokens 
       SET access_token = $1, expires_at = $2, updated_at = NOW()
       WHERE user_id = $3`,
      [credentials.access_token, new Date(credentials.expiry_date), userId]
    );
    return { access_token: credentials.access_token };
  } finally {
    client.release();
  }
}

export function createClassroomClient(accessToken) {
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.classroom({ version: 'v1', auth: oauth2Client });
}

export async function storeClassroomTokens(userId, tokens) {
  const client = await getClient();
  try {
    await client.query(
      `INSERT INTO google_classroom_tokens (user_id, access_token, refresh_token, expires_at, scope)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         expires_at = EXCLUDED.expires_at,
         scope = EXCLUDED.scope,
         updated_at = NOW()`,
      [userId, tokens.access_token, tokens.refresh_token, new Date(tokens.expiry_date), tokens.scope]
    );
  } finally {
    client.release();
  }
}

export async function revokeClassroomTokens(userId) {
  const client = await getClient();
  try {
    // Get current tokens to revoke
    const result = await client.query(
      'SELECT access_token FROM google_classroom_tokens WHERE user_id = $1',
      [userId]
    );
    if (result.rows.length > 0) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${result.rows[0].access_token}`, {
          method: 'POST',
        });
      } catch (e) {
        console.warn('Token revocation failed:', e.message);
      }
    }
    await client.query('DELETE FROM google_classroom_tokens WHERE user_id = $1', [userId]);
  } finally {
    client.release();
  }
}

export async function getClassroomConnectionStatus(userId) {
  const client = await getClient();
  try {
    const result = await client.query(
      `SELECT id, expires_at, scope, created_at 
       FROM google_classroom_tokens 
       WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) return { connected: false };
    
    const row = result.rows[0];
    return {
      connected: true,
      expires_at: row.expires_at,
      scope: row.scope,
      connected_at: row.created_at,
      expired: new Date(row.expires_at) < new Date(),
    };
  } finally {
    client.release();
  }
}