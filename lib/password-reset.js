/**
 * Password Reset Helper
 * 
 * Secure, reusable password reset token management.
 * - Tokens are generated server-side, hashed with SHA-256, stored in DB
 * - Tokens are single-use, expire after 1 hour
 * - Purpose-constrained (prevents token reuse across contexts)
 * - Successful reset revokes all user sessions
 * - Reset JWTs CANNOT be used as access cookies (different secret/purpose)
 * 
 * Email delivery via Resend integration (mockable for tests)
 */

import crypto from 'crypto';
import { getClient } from './db.js';
import { hashPassword } from './password.js';

const RESET_TOKEN_EXPIRY_HOURS = 1;
const RESET_TOKEN_BYTES = 32; // 256-bit token
const RESET_TOKEN_PURPOSE = 'password_reset';

/**
 * Generate a cryptographically secure random token
 * @returns {string} URL-safe base64 token
 */
function generateResetToken() {
  return crypto.randomBytes(RESET_TOKEN_BYTES).toString('base64url');
}

/**
 * Hash a token for storage
 * @param {string} token - Plain token
 * @returns {string} SHA-256 hex hash
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Check if a token is expired
 * @param {Date} expiresAt - Expiry timestamp
 * @returns {boolean}
 */
function isExpired(expiresAt) {
  return new Date(expiresAt) < new Date();
}

/**
 * Create a password reset token for a user
 * Stores hashed token in DB, returns plain token for email delivery
 * 
 * @param {Object} params
 * @param {string} params.userId - User UUID
 * @param {string} params.email - User email
 * @param {Object} [params.client] - Optional DB client (for transaction)
 * @returns {Promise<{token: string, expiresAt: Date}>}
 */
export async function createPasswordResetToken({ userId, email, client: externalClient = null }) {
  const token = generateResetToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  
  const useClient = externalClient || await getClient();
  const shouldRelease = !externalClient;
  
  try {
    await useClient.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, email, purpose, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, tokenHash, email.toLowerCase(), RESET_TOKEN_PURPOSE, expiresAt]
    );
    return { token, expiresAt };
  } finally {
    if (shouldRelease) useClient.release();
  }
}

/**
 * Verify and consume a password reset token
 * Returns user info if valid, null if invalid/expired/used
 * 
 * @param {Object} params
 * @param {string} params.token - Plain token from user
 * @param {string} params.email - Email for verification (case-insensitive)
 * @param {Object} [params.client] - Optional DB client (for transaction)
 * @returns {Promise<{userId: string, email: string} | null>}
 */
export async function verifyAndConsumeResetToken({ token, email, client: externalClient = null }) {
  if (!token || !email) return null;
  const tokenHash = hashToken(token);
  const emailLower = email.toLowerCase().trim();
  
  const useClient = externalClient || await getClient();
  const shouldRelease = !externalClient;
  
  try {
    // Consume atomically so concurrent requests cannot both reset the account.
    const result = await useClient.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE token_hash = $1 AND email = $2 AND purpose = $3
         AND used_at IS NULL AND expires_at > NOW()
       RETURNING user_id, email`,
      [tokenHash, emailLower, RESET_TOKEN_PURPOSE]
    );
    
    if (result.rows.length === 0) {
      return null; // Not found or already used
    }
    
    const row = result.rows[0];
    return { userId: row.user_id, email: row.email };
  } finally {
    if (shouldRelease) useClient.release();
  }
}

/**
 * Execute password reset: update password, revoke all sessions
 * Must be called after verifyAndConsumeResetToken succeeds
 * 
 * @param {Object} params
 * @param {string} params.userId - User UUID
 * @param {string} params.newPassword - New plaintext password
 * @param {Object} [params.client] - Optional DB client (for transaction)
 * @returns {Promise<boolean>} True if password was updated
 */
export async function executePasswordReset({ userId, newPassword, client: externalClient = null }) {
  const newHash = await hashPassword(newPassword);
  
  const useClient = externalClient || await getClient();
  const shouldRelease = !externalClient;
  
  try {
    // Start transaction for atomicity
    if (!externalClient) await useClient.query('BEGIN');
    
    try {
      // Update password
      const updateResult = await useClient.query(
        `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [newHash, userId]
      );
      
      if (updateResult.rowCount === 0) {
        throw new Error('User not found');
      }
      
      // Revoke ALL sessions for this user (security: force re-login)
      await useClient.query(
        `DELETE FROM sessions WHERE user_id = $1`,
        [userId]
      );
      
      if (!externalClient) await useClient.query('COMMIT');
      return true;
    } catch (err) {
      if (!externalClient) await useClient.query('ROLLBACK');
      throw err;
    }
  } finally {
    if (shouldRelease) useClient.release();
  }
}

/**
 * Send password reset email via Resend
 * Mockable for tests - pass custom sendFn
 * 
 * @param {Object} params
 * @param {string} params.email - Recipient email
 * @param {string} params.token - Plain reset token
 * @param {string} params.resetUrl - Full reset URL (with token as query param)
 * @param {Function} [params.sendFn] - Custom send function for testing
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendPasswordResetEmail({ email, token, resetUrl, sendFn = null }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'HomeworkHelper <noreply@letsmakeai.fun>';
  
  // Use custom send function if provided (for testing)
  if (sendFn) {
    return sendFn({ email, token, resetUrl });
  }
  
  // Production: send via Resend
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured - cannot send reset email');
    return { success: false, error: 'Email service not configured' };
  }
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #fef7ee 0%, #fdf4e3 100%); border-radius: 16px; padding: 40px; text-align: center;">
        <div style="width: 64px; height: 64px; border-radius: 16px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h1 style="color: #1f2937; font-size: 24px; font-weight: 700; margin: 0 0 8px;">HomeworkHelper</h1>
        <p style="color: #6b7280; font-size: 16px; margin: 0 0 32px;">AI-powered homework grading for teachers</p>
        
        <div style="background: white; border-radius: 12px; padding: 32px; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 16px;">Reset Your Password</h2>
          <p style="color: #4b5563; margin: 0 0 24px;">You requested a password reset for your HomeworkHelper account. Click the button below to set a new password:</p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; text-decoration: none; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);">
              Reset Password
            </a>
          </div>
          
          <p style="color: #9ca3af; font-size: 14px; margin: 24px 0 0; text-align: center;">
            Or copy this link: <br>
            <a href="${resetUrl}" style="color: #f59e0b; word-break: break-all;">${resetUrl}</a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            This link expires in ${RESET_TOKEN_EXPIRY_HOURS} hour(s) and can only be used once.<br>
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
        
        <p style="color: #9ca3af; font-size: 12px; margin: 24px 0 0;">
          HomeworkHelper • <a href="https://letsmakeai.fun" style="color: #f59e0b;">letsmakeai.fun</a>
        </p>
      </div>
    </body>
    </html>
  `;
  
  const text = `
Reset Your Password - HomeworkHelper

You requested a password reset for your HomeworkHelper account.

Click this link to set a new password:
${resetUrl}

This link expires in ${RESET_TOKEN_EXPIRY_HOURS} hour(s) and can only be used once.
If you didn't request this, you can safely ignore this email.

HomeworkHelper
https://letsmakeai.fun
  `.trim();
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: 'Reset Your HomeworkHelper Password',
        html,
        text,
      }),
    });
    
    if (!response.ok) {
      await response.text();
      return { success: false, error: 'Email send failed' };
    }
    
    const data = await response.json();
    return { success: true, messageId: data.id };
  } catch {
    // Do not log raw error or return provider message - fixed generic error
    return { success: false, error: 'Email send failed' };
  }
}

/**
 * Complete password reset flow: create token, send email
 * Returns generic response (no account existence disclosure)
 * 
 * @param {Object} params
 * @param {string} params.email - User email
 * @param {Object} [params.client] - Optional dedicated, idle DB client. This helper owns BEGIN/COMMIT/ROLLBACK; the caller retains release ownership.
 * @param {Function} [params.sendFn] - Custom send function for testing
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function requestPasswordReset({ email, client = null, sendFn = null }) {
  const emailLower = email.toLowerCase().trim();
  
  // Generic response - never reveal if account exists
  const genericResponse = {
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent.'
  };
  
  const useClient = client || await getClient();
  const shouldRelease = !client;
  // This helper owns the transaction; injected clients must be dedicated and idle.
  let committed = false;
  
  try {
    await useClient.query('BEGIN');
    // Check if user exists and has a password (not Google-only)
    const userResult = await useClient.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [emailLower]
    );
    
    const user = userResult.rows[0];
    
    // Always return generic response regardless of user existence
    if (!user) {
      await useClient.query('COMMIT');
      committed = true;
      return genericResponse;
    }
    
    // Google-only accounts (no password_hash) cannot use password reset
    if (!user.password_hash) {
      await useClient.query('COMMIT');
      committed = true;
      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      };
    }
    
    // Create reset token
    const { token } = await createPasswordResetToken({
      userId: user.id,
      email: user.email,
      client: useClient
    });
    
    // Build reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'https://letsmakeai.fun';
    const resetUrl = `${frontendUrl}/auth?mode=reset&token=${encodeURIComponent(token)}`;
    
    // Persist the token before starting email delivery. The email must never
    // race an uncommitted token transaction.
    await useClient.query('COMMIT');
    committed = true;
    
    // Send email (non-blocking - don't fail the request if email fails)
    sendPasswordResetEmail({ email: user.email, token, resetUrl, sendFn })
      .then(result => {
        if (!result.success) {
          // Do not log provider error details
          console.error('Failed to send password reset email');
        }
      })
      .catch(() => console.error('Reset email delivery failed'));
    
    return genericResponse;
  } finally {
    if (!committed) {
      // A failed lookup/insert must not leave a pooled connection in a transaction.
      try { await useClient.query('ROLLBACK'); } catch { /* already committed or rolled back */ }
    }
    if (shouldRelease) useClient.release();
  }
}

/**
 * Complete password reset: verify token, update password, revoke sessions
 * 
 * @param {Object} params
 * @param {string} params.token - Plain reset token
 * @param {string} params.email - Email for verification
 * @param {string} params.newPassword - New password
 * @param {Object} [params.client] - Optional DB client
 * @returns {Promise<{success: boolean, message: string, error?: string}>}
 */
export async function completePasswordReset({ token, email, newPassword, client = null }) {
  const useClient = client || await getClient();
  const shouldRelease = !client;
  
  try {
    await useClient.query('BEGIN');
    // Verify token and get user
    const verification = await verifyAndConsumeResetToken({
      token,
      email,
      client: useClient
    });
    
    if (!verification) {
      await useClient.query('ROLLBACK');
      return {
        success: false,
        message: 'Invalid or expired reset link. Please request a new one.',
        error: 'INVALID_TOKEN'
      };
    }
    
    // Execute password reset (updates password, revokes sessions)
    await executePasswordReset({
      userId: verification.userId,
      newPassword,
      client: useClient
    });

    await useClient.query('COMMIT');
    
    return {
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    };
  } catch (error) {
    try { await useClient.query('ROLLBACK'); } catch { /* transaction already ended */ }
    throw error;
  } finally {
    if (shouldRelease) useClient.release();
  }
}

/**
 * Clean up expired reset tokens (maintenance)
 * @param {Object} [params.client] - Optional DB client
 * @returns {Promise<number>} Number of deleted tokens
 */
export async function cleanupExpiredResetTokens({ client = null } = {}) {
  const useClient = client || await getClient();
  const shouldRelease = !client;
  
  try {
    const result = await useClient.query(
      `DELETE FROM password_reset_tokens 
       WHERE expires_at < NOW() OR used_at IS NOT NULL`
    );
    return result.rowCount || 0;
  } finally {
    if (shouldRelease) useClient.release();
  }
}
