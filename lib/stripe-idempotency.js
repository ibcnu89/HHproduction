/**
 * Stripe Idempotency Utilities
 * Handles idempotency keys for checkout sessions and webhook deduplication
 */

import { getClient } from './db.js';
import crypto from 'crypto';

/**
 * Generate an idempotency key for Stripe checkout sessions
 * Format: hh_<userId>_<planType>_<timestamp>
 */
export function generateIdempotencyKey(userId, planType = 'monthly') {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `hh_${userId}_${planType}_${timestamp}_${random}`;
}

/**
 * Store an idempotency key with its result
 * @param {string} key - Idempotency key
 * @param {Object} result - Result to cache (checkout session URL, etc.)
 * @param {number} ttlSeconds - Time to live (default 24 hours)
 */
export async function storeIdempotencyResult(key, result, ttlSeconds = 86400) {
  const client = await getClient();
  try {
    await client.query(
      `INSERT INTO idempotency_keys (key, result, expires_at)
       VALUES ($1, $2, NOW() + $3 * INTERVAL '1 second')
       ON CONFLICT (key) DO UPDATE SET
         result = EXCLUDED.result,
         expires_at = EXCLUDED.expires_at`,
      [key, JSON.stringify(result), ttlSeconds]
    );
  } finally {
    client.release();
  }
}

/**
 * Get a cached idempotency result
 * @param {string} key - Idempotency key
 * @returns {Object|null} Cached result or null if not found/expired
 */
export async function getIdempotencyResult(key) {
  const client = await getClient();
  try {
    const result = await client.query(
      `SELECT result FROM idempotency_keys
       WHERE key = $1 AND expires_at > NOW()`,
      [key]
    );
    return result.rows[0]?.result || null;
  } finally {
    client.release();
  }
}

/**
 * Check if a webhook event has already been processed
 * @param {string} eventId - Stripe event ID
 * @returns {boolean} True if already processed
 */
export async function isWebhookEventProcessed(eventId) {
  const client = await getClient();
  try {
    const result = await client.query(
      `SELECT 1 FROM webhook_events WHERE event_id = $1`,
      [eventId]
    );
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}

/**
 * Mark a webhook event as processed
 * @param {string} eventId - Stripe event ID
 * @param {string} eventType - Stripe event type
 */
export async function markWebhookEventProcessed(eventId, eventType) {
  const client = await getClient();
  try {
    await client.query(
      `INSERT INTO webhook_events (event_id, event_type, processed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, eventType]
    );
  } finally {
    client.release();
  }
}

/**
 * Create a Stripe checkout session with idempotency
 * @param {Object} stripe - Stripe instance
 * @param {Object} params - Checkout session params
 * @param {string} idempotencyKey - Idempotency key
 * @returns {Object} Stripe checkout session
 */
export async function createCheckoutSessionWithIdempotency(stripe, params, idempotencyKey) {
  return stripe.checkout.sessions.create(params, {
    idempotencyKey,
  });
}

/**
 * Create a Stripe billing portal session with idempotency
 * @param {Object} stripe - Stripe instance
 * @param {Object} params - Portal session params
 * @param {string} idempotencyKey - Idempotency key
 * @returns {Object} Stripe portal session
 */
export async function createPortalSessionWithIdempotency(stripe, params, idempotencyKey) {
  return stripe.billingPortal.sessions.create(params, {
    idempotencyKey,
  });
}

export default {
  generateIdempotencyKey,
  storeIdempotencyResult,
  getIdempotencyResult,
  isWebhookEventProcessed,
  markWebhookEventProcessed,
  createCheckoutSessionWithIdempotency,
  createPortalSessionWithIdempotency,
};