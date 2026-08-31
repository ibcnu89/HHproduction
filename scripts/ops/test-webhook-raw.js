#!/usr/bin/env node
/**
 * Send raw webhook using native http module (no body parsing)
 */

import http from 'http';
import https from 'https';
import { createHmac } from 'crypto';

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_xxxxxxxxxxxxx';
const ENDPOINT = 'https://hhproduction-production.up.railway.app/api/billing/webhook';

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
      metadata: { user_id: 'test-user-id' },
    },
  },
  livemode: false,
  pending_webhooks: 1,
  request: { id: 'req_test_' + Date.now(), idempotency_key: null },
  type: 'checkout.session.completed',
};

const payload = JSON.stringify(event);
const timestamp = Math.floor(Date.now() / 1000);
const signedPayload = `${timestamp}.${payload}`;
const signature = createHmac('sha256', WEBHOOK_SECRET).update(signedPayload).digest('hex');
const stripeSignature = `t=${timestamp},v1=${signature}`;

const options = {
  hostname: 'hhproduction-production.up.railway.app',
  port: 443,
  path: '/api/billing/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Stripe-Signature': stripeSignature,
    'Content-Length': Buffer.byteLength(payload),
  },
};

console.log('Sending test webhook...');
console.log('Event:', event.type);
console.log('Signature:', stripeSignature.substring(0, 50) + '...');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
    if (res.statusCode === 200) {
      console.log('\n✅ Webhook test PASSED!');
    } else {
      console.log('\n❌ Webhook test FAILED');
    }
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.write(payload);
req.end();