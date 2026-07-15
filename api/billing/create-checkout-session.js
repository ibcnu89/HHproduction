/**
 * POST /api/billing/create-checkout-session
 * Creates a Stripe Checkout Session for a new subscription with 7-day trial.
 * Requires authenticated user.
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
    // Check if user already has a Stripe customer
    const userResult = await client.query(
      'SELECT stripe_customer_id, subscription_status, stripe_subscription_id FROM users WHERE id = $1',
      [user.id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const dbUser = userResult.rows[0];

    // If user already has an active/trialing subscription, redirect to portal
    if (dbUser.subscription_status === 'active' || dbUser.subscription_status === 'trialing') {
      return res.status(400).json({
        error: 'You already have an active subscription. Use the billing portal to manage it.',
        code: 'SUBSCRIPTION_EXISTS',
      });
    }

    let customerId = dbUser.stripe_customer_id;

    // Create Stripe customer if needed
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || user.email.split('@')[0],
        metadata: { user_id: user.id },
      });
      customerId = customer.id;

      await client.query(
        'UPDATE users SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2',
        [customerId, user.id]
      );
    }

    // Get the price ID from env (configured in Stripe dashboard)
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      console.error('STRIPE_PRICE_ID not configured');
      return res.status(500).json({ error: 'Billing not configured' });
    }

    // Create Checkout Session with 7-day trial
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: { user_id: user.id },
      },
      success_url: `${process.env.APP_URL}/settings?billing=success`,
      cancel_url: `${process.env.APP_URL}/settings?billing=canceled`,
      metadata: { user_id: user.id },
      allow_promotion_codes: false, // Not in scope per requirements
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Create checkout session error:', error);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  } finally {
    client.release();
  }
}