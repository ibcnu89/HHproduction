/**
 * GET /api/billing/status
 * Returns current subscription status for the authenticated user.
 * Used by frontend to gate features and show trial/active/canceled states.
 */

import { getClient } from '../../lib/db.js';
import { requireAuth } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = requireAuth(req, res);
  if (!user) return;

  const client = await getClient();
  try {
    const userResult = await client.query(
      `SELECT 
         stripe_customer_id,
         stripe_subscription_id,
         stripe_subscription_status,
         stripe_price_id,
         stripe_current_period_end,
         stripe_trial_end,
         subscription_status
       FROM users WHERE id = $1`,
      [user.id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const u = userResult.rows[0];

    // Compute trial days remaining if in trial
    let trialDaysRemaining = null;
    if (u.subscription_status === 'trialing' && u.stripe_trial_end) {
      const now = new Date();
      const trialEnd = new Date(u.stripe_trial_end);
      const diffMs = trialEnd - now;
      if (diffMs > 0) {
        trialDaysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      } else {
        trialDaysRemaining = 0;
      }
    }

    return res.status(200).json({
      subscription_status: u.subscription_status,
      stripe_subscription_status: u.stripe_subscription_status,
      stripe_subscription_id: u.stripe_subscription_id,
      stripe_price_id: u.stripe_price_id,
      current_period_end: u.stripe_current_period_end,
      trial_end: u.stripe_trial_end,
      trial_days_remaining: trialDaysRemaining,
      has_customer: !!u.stripe_customer_id,
    });
  } catch (error) {
    console.error('Billing status error:', error);
    return res.status(500).json({ error: 'Failed to fetch billing status' });
  } finally {
    client.release();
  }
}