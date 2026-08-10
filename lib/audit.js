/**
 * Audit Logging Middleware
 * Non-blocking audit log for sensitive actions
 */

import { getClient } from './db.js';

/**
 * Log an audit event (non-blocking)
 * @param {Object} params
 * @param {string|null} params.userId - User UUID
 * @param {string} params.action - Action name (e.g., 'login', 'delete_account', 'grade', 'sync_classroom')
 * @param {string} params.resourceType - Resource type (e.g., 'user', 'batch_session', 'student', 'grading_result')
 * @param {string|null} params.resourceId - Resource UUID
 * @param {Object} params.req - Express request object (for IP, user-agent)
 * @param {Object} params.metadata - Additional metadata
 */
export async function auditLog({ userId, action, resourceType, resourceId, req, metadata = {} }) {
  // Fire and forget - never block the request
  const client = await getClient().catch(() => null);
  if (!client) return;

  try {
    const ip = req?.ip || req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress || null;
    const userAgent = req?.get?.('user-agent') || req?.headers?.['user-agent'] || null;
    
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, resourceType, resourceId, ip, userAgent, JSON.stringify(metadata)]
    );
  } catch (err) {
    // Never throw - audit logging must never break the request
    console.error('Audit log failed:', err.message);
  } finally {
    client.release().catch(() => {});
  }
}

/**
 * Decorator for route handlers - wraps handler with audit logging
 * @param {string} action - Action name
 * @param {string} resourceType - Resource type
 * @returns {Function} Middleware wrapper
 */
export function withAudit(action, resourceType) {
  return (handler) => async (req, res) => {
    const userId = req.user?.sub || null;
    const resourceId = req.params?.id || null;
    const startTime = Date.now();
    
    try {
      const result = await handler(req, res);
      
      // Log success
      await auditLog({
        userId,
        action,
        resourceType,
        resourceId,
        req,
        metadata: { 
          status: res.statusCode, 
          duration_ms: Date.now() - startTime 
        }
      });
      
      return result;
    } catch (err) {
      // Log failure
      await auditLog({
        userId,
        action: `${action}_failed`,
        resourceType,
        resourceId,
        req,
        metadata: { 
          error: err.message, 
          status: err.status || 500,
          duration_ms: Date.now() - startTime 
        }
      });
      throw err;
    }
  };
}

// Pre-defined action names for consistency
export const AuditActions = {
  // Auth
  LOGIN: 'login',
  LOGOUT: 'logout',
  REGISTER: 'register',
  PASSWORD_RESET: 'password_reset',
  PASSWORD_CHANGE: 'password_change',
  UNLINK_GOOGLE: 'unlink_google',
  DELETE_ACCOUNT: 'delete_account',
  
  // Grading
  GRADE: 'grade',
  BATCH_GRADE: 'batch_grade',
  EXTRACT_HANDWRITING: 'extract_handwriting',
  EXTRACT_RUBRIC: 'extract_rubric',
  SAVE_RUBRIC: 'save_rubric',
  
  // Classroom
  SYNC_CLASSROOM: 'sync_classroom',
  CLASSROOM_CONNECT: 'classroom_connect',
  CLASSROOM_DISCONNECT: 'classroom_disconnect',
  CLASSROOM_PUSH_GRADE: 'classroom_push_grade',
  
  // Billing
  BILLING_CHECKOUT: 'billing_checkout',
  BILLING_PORTAL: 'billing_portal',
  SUBSCRIPTION_UPDATE: 'subscription_update',
  
  // Data
  DATA_EXPORT: 'data_export',
  DATA_DELETE: 'data_delete',
  PREFERENCES_UPDATE: 'preferences_update',
};

// Type for AuditAction (for JSDoc/TypeScript if needed)
/**
 * @typedef {keyof typeof AuditActions} AuditAction
 */