import crypto from 'crypto';
import fetch from 'node-fetch';

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || 'whsec_xxxxxxxxxxxxx';
const ENDPOINT = process.env.TEST_ENDPOINT || 'http://localhost:3000/api/webhooks/resend/reply';
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_xxxxxxxxxxxxx';

async function main() {
  // Create a mock email.received event (matching Resend's payload structure)
  const event = {
    type: 'email.received',
    data: {
      from: 'teacher@example.edu',
      to: ['skyler@letsmakeai.fun'],
      subject: 'Re: AI Grading for Your Classroom',
      text: 'Hi, this looks interesting. Can you tell me more about pricing?',
      html: '<p>Hi, this looks interesting. Can you tell me more about pricing?</p>',
      message_id: '<msg-' + Date.now() + '@example.edu>',
      created_at: new Date().toISOString(),
    },
  };

  // Serialize to JSON string (raw body)
  const payload = JSON.stringify(event);

  // Generate signature using Resend's HMAC-SHA256 algorithm
  const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  console.log('Sending test Resend webhook to:', ENDPOINT);
  console.log('Event type:', event.type);
  console.log('Signature:', signature.substring(0, 50) + '...');

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Resend-Signature': signature,
      },
      body: payload,  // Send raw JSON string as body
    });

    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', text);

    if (response.status === 200) {
      console.log('✅ Resend webhook test PASSED!');
    } else {
      console.log('❌ Resend webhook test FAILED');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();