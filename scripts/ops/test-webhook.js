import Stripe from 'stripe';
import fetch from 'node-fetch';

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_xxxxxxxxxxxxx';
const ENDPOINT = 'https://hhproduction-production.up.railway.app/api/billing/webhook';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_xxxxxxxxxxxxx', {
  apiVersion: '2024-12-18.acacia',
});

async function main() {
  // Create a mock checkout.session.completed event
  const event = {
    id: 'evt_test_' + Date.now(),
    object: 'event',
    api_version: '2024-12-18.acacia',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'cs_test_' + Date.now(),
        object: 'checkout.session',
        payment_status: 'paid',
        mode: 'subscription',
        subscription: 'sub_test_' + Date.now(),
        customer: 'cus_test_' + Date.now(),
        metadata: {
          user_id: 'test-user-id',
        },
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: 'req_test_' + Date.now(), idempotency_key: null },
    type: 'checkout.session.completed',
  };

  // Serialize to JSON string (raw body)
  const payload = JSON.stringify(event);
  
  // Generate signature using Stripe's algorithm
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  
  const crypto = await import('crypto');
  const signature = crypto.createHmac('sha256', WEBHOOK_SECRET)
    .update(signedPayload)
    .digest('hex');
  
  const stripeSignature = `t=${timestamp},v1=${signature}`;

  console.log('Sending test webhook to:', ENDPOINT);
  console.log('Event type:', event.type);
  console.log('Signature:', stripeSignature.substring(0, 50) + '...');

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': stripeSignature,
      },
      body: payload,  // Send raw JSON string as body
    });

    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', text);
    
    if (response.status === 200) {
      console.log('✅ Webhook test PASSED!');
    } else {
      console.log('❌ Webhook test FAILED');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();