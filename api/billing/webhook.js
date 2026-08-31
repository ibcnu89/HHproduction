/**
 * POST /api/billing/webhook
 * Stripe webhook handler for subscription lifecycle events.
 * Requires raw body for signature verification.
 * 
 * On Railway: raw body is captured by the Express middleware in server.js
 */

import Stripe from 'stripe';
import { getClient } from '../../lib/db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // For Vercel serverless functions with Express 5:
  // We need the raw body for Stripe signature verification.
  // Vercel provides req.rawBody when the route is configured with rawBody: true in vercel.json
  // Fallback: use req.body if already parsed (won't work for signature verification if body-parser ran)
  let rawBody;
  
  try {
    // Try to get raw body - Vercel injects this when configured properly
    rawBody = req.rawBody;
    
    // Fallback: if rawBody not available, try reading from the request stream
    if (!rawBody && req.readable) {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      rawBody = Buffer.concat(chunks).toString('utf8');
    }
    
    // If still no raw body, we can't verify signature securely
    if (!rawBody) {
      console.error('No raw body available for webhook verification');
      return res.status(400).json({ error: 'Raw body required for signature verification' });
    }
  } catch (e) {
    console.error('Error reading raw body:', e);
    return res.status(400).json({ error: 'Failed to read request body' });
  }

  const signature = req.headers['stripe-signature'];

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  if (!signature) {
    console.error('Missing stripe-signature header');
    return res.status(400).json({ error: 'Missing signature' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  const client = await getClient();
  try {
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        // Checkout completed - subscription created (may be in trial)
        const session = event.data.object;
        await handleCheckoutCompleted(client, session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        // Subscription created or updated (status changes, trial ending, etc.)
        const subscription = event.data.object;
        await handleSubscriptionUpdate(client, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        // Subscription canceled - access ends at period end or immediately
        const subscription = event.data.object;
        await handleSubscriptionDeleted(client, subscription);
        break;
      }

      case 'invoice.payment_failed': {
        // Payment failed - will transition to past_due
        // Handled by subscription.updated, but we log for visibility
        const invoice = event.data.object;
        console.log('Invoice payment failed:', invoice.id, 'for customer:', invoice.customer);
        break;
      }

      default: {
        console.log(`Unhandled webhook event type: ${event.type}`);
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    // Return 200 to avoid Stripe retrying (we logged the error)
    // But DON'T do this for signature verification failures
    return res.status(500).json({ error: 'Webhook handler failed' });
  } finally {
    client.release();
  }
}

async function handleCheckoutCompleted(client, session) {
  const userId = session.metadata?.user_id;
  const subscriptionId = session.subscription;
  const customerId = session.customer;

  if (!userId || !subscriptionId) {
    console.error('Missing metadata in checkout.session.completed:', session.id);
    return;
  }

  // Fetch the subscription to get full details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await client.query(
    `UPDATE users SET
       stripe_customer_id = $1,
       stripe_subscription_id = $2,
       stripe_subscription_status = $3,
       stripe_price_id = $4,
       stripe_current_period_end = to_timestamp($5),
       stripe_trial_end = $6,
       updated_at = NOW()
     WHERE id = $7`,
    [
      customerId,
      subscriptionId,
      subscription.status,
      subscription.items.data[0]?.price?.id || null,
      subscription.current_period_end,
      subscription.trial_end ? subscription.trial_end : null,
      userId,
    ]
  );

  console.log(`Checkout completed for user ${userId}: sub ${subscriptionId} status ${subscription.status}`);
}

async function handleSubscriptionUpdate(client, subscription) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;

  // Find user by stripe_customer_id
  const userResult = await client.query(
    'SELECT id FROM users WHERE stripe_customer_id = $1',
    [customerId]
  );

  if (userResult.rowCount === 0) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }

  const userId = userResult.rows[0].id;

  await client.query(
    `UPDATE users SET
       stripe_subscription_id = $1,
       stripe_subscription_status = $2,
       stripe_price_id = $3,
       stripe_current_period_end = to_timestamp($4),
       stripe_trial_end = $5,
       updated_at = NOW()
     WHERE id = $6`,
    [
      subscriptionId,
      subscription.status,
      subscription.items.data[0]?.price?.id || null,
      subscription.current_period_end,
      subscription.trial_end ? subscription.trial_end : null,
      userId,
    ]
  );

  console.log(`Subscription updated for user ${userId}: sub ${subscriptionId} status ${subscription.status}`);
}

async function handleSubscriptionDeleted(client, subscription) {
  const customerId = subscription.customer;

  const userResult = await client.query(
    'SELECT id FROM users WHERE stripe_customer_id = $1',
    [customerId]
  );

  if (userResult.rowCount === 0) {
    console.error(`No user found for customer ${customerId} on subscription delete`);
    return;
  }

  const userId = userResult.rows[0].id;

  // Clear subscription but keep customer_id for history
  await client.query(
    `UPDATE users SET
       stripe_subscription_id = NULL,
       stripe_subscription_status = 'canceled',
       stripe_price_id = NULL,
       stripe_current_period_end = NULL,
       stripe_trial_end = NULL,
       updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );

  console.log(`Subscription deleted for user ${userId}: sub ${subscription.id}`);
}