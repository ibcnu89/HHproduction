/**
 * POST /api/billing/portal-session
 * Creates a Stripe Billing Portal session for subscription management.
 * Requires authenticated user with existing Stripe customer.
 */

import Stripe from 'stripe';
import { getClient } from '../../lib/db.js';
import { requireAuth } from '../../lib/auth.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const user = requireAuth(req, res);
  if (!user) return;

  const client = await getClient();
  try {
    const userResult = await client.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [user.id]
    );

    if (userResult.rowCount === 0 || !userResult.rows[0].stripe_customer_id) {
      return res.status(404).json({ error: 'No billing account found. Subscribe first.' });
    }

    const customerId = userResult.rows[0].stripe_customer_id;

    // Create Billing Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.APP_URL}/settings`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Create portal session error:', error);
    return res.status(500).json({ error: 'Failed to open billing portal' });
  } finally {
    client.release();
  }
}