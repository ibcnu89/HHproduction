#!/usr/bin/env node
/**
 * Resend Webhook Handler for Inbound Email Replies
 * Deploy to Railway as a separate service or add to existing API server
 * 
 * Required env vars:
 * - DATABASE_URL
 * - RESEND_WEBHOOK_SECRET (from Resend dashboard)
 * - DISCORD_OPS_WEBHOOK (for alerts)
 */

import express from 'express';
import crypto from 'crypto';
import pg from 'pg';

const app = express();
app.use(express.raw({ type: 'application/json' })); // Need raw body for signature verification

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;
const DISCORD_WEBHOOK = process.env.DISCORD_OPS_WEBHOOK;

if (!RESEND_WEBHOOK_SECRET) {
  console.error('ERROR: RESEND_WEBHOOK_SECRET not set');
  process.exit(1);
}

/**
 * Verify Resend webhook signature
 * Resend uses HMAC-SHA256 with the webhook secret
 */
function verifySignature(req, secret) {
  const signature = req.headers['resend-signature'];
  if (!signature) return false;
  
  const expected = crypto
    .createHmac('sha256', secret)
    .update(req.rawBody)
    .digest('hex');
  
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Simple heuristic sentiment analysis
 */
function analyzeSentiment(subject, body) {
  const text = `${subject || ''} ${body || ''}`.toLowerCase();
  
  // Positive indicators
  const positiveKeywords = [
    'interested', 'tell me more', 'let\'s talk', 'demo', 'schedule', 
    'meeting', 'call me', 'contact me', 'sounds good', 'great',
    'love this', 'excited', 'how much', 'pricing', 'trial',
    'sign up', 'get started', 'more info', 'details',
    'yes', 'please', 'would like', 'helpful', 'useful'
  ];
  
  // Negative indicators
  const negativeKeywords = [
    'not interested', 'unsubscribe', 'remove', 'stop', 'spam',
    'don\'t contact', 'no thanks', 'not a fit', 'busy',
    'don\'t have time', 'already using', 'competitor',
    'no budget', 'not now', 'go away', 'leave me alone'
  ];
  
  let positiveScore = 0;
  let negativeScore = 0;
  
  for (const kw of positiveKeywords) {
    if (text.includes(kw)) positiveScore++;
  }
  
  for (const kw of negativeKeywords) {
    if (text.includes(kw)) negativeScore++;
  }
  
  if (positiveScore > negativeScore && positiveScore > 0) return 'positive';
  if (negativeScore > positiveScore && negativeScore > 0) return 'negative';
  if (positiveScore > 0 || negativeScore > 0) return 'neutral';
  return 'unknown';
}

/**
 * Send Discord alert
 */
async function sendDiscordAlert(prospect, reply, sentiment) {
  if (!DISCORD_WEBHOOK) return;
  
  const colors = {
    positive: 0x22c55e,
    neutral: 0x3b82f6,
    negative: 0xf59e0b,
    unknown: 0x6b7280
  };
  
  const emojis = {
    positive: '✅',
    neutral: 'ℹ️',
    negative: '⚠️',
    unknown: '❓'
  };
  
  const embed = {
    title: `${emojis[sentiment]} New Reply: ${sentiment.toUpperCase()}`,
    description: `**From:** ${reply.from_email}\n**Subject:** ${reply.subject || '(no subject)'}\n**Sentiment:** ${sentiment}`,
    color: colors[sentiment],
    timestamp: new Date().toISOString(),
    fields: [
      { name: 'Preview', value: (reply.body || '').substring(0, 500), inline: false },
      ],
    footer: { text: 'HomeworkHelper Outreach' }
  };
  
  if (prospect) {
    embed.fields.unshift(
      { name: 'School', value: prospect.school, inline: true },
      { name: 'State', value: prospect.state, inline: true },
      { name: 'Grade', value: prospect.subject, inline: true }
    );
  }
  
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (err) {
    console.error('Discord alert failed:', err.message);
  }
}

/**
 * Forward reply to monitoring emails
 */
async function forwardReplyToEmails(prospect, reply, sentiment) {
  const forwardEmails = [
    'ibcnu89@gmail.com',
    // Add your monitoring email here
  ];
  
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set, skipping email forward');
    return;
  }
  
  const subject = `[${sentiment.toUpperCase()}] Reply: ${reply.subject || '(no subject)'}`;
  const html = `
    <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; color: #1a1a1a;">
      <h2>New Inbound Reply (${sentiment})</h2>
      <p><strong>From:</strong> ${reply.from_email}</p>
      <p><strong>Subject:</strong> ${reply.subject || '(no subject)'}</p>
      <p><strong>Sentiment:</strong> ${sentiment}</p>
      <p><strong>Received:</strong> ${new Date(reply.received_at).toLocaleString()}</p>
      ${prospect ? `
        <p><strong>School:</strong> ${prospect.school}</p>
        <p><strong>State:</strong> ${prospect.state}</p>
        <p><strong>Grade/Subject:</strong> ${prospect.subject}</p>
      ` : ''}
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <h3>Message Body:</h3>
      <pre style="background:#f5f5f5;padding:16px;border-radius:4px;white-space:pre-wrap;">${reply.body}</pre>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <p style="color:#888;font-size:12px">HomeworkHelper Outreach Webhook</p>
    </div>
  `;
  
  for (const email of forwardEmails) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'HomeworkHelper Replies <replies@letsmakeai.fun>',
          to: email,
          subject,
          html,
        }),
      });
      console.log(`Forwarded reply to ${email}`);
    } catch (err) {
      console.error(`Failed to forward to ${email}:`, err.message);
    }
  }
}

/**
 * Create follow-up task for positive replies
 */
async function createFollowup(prospectId, replyId) {
  const client = await pool.connect();
  try {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // 1 day after reply
    
    await client.query(`
      INSERT INTO outreach_followups (prospect_id, reply_id, due_date, status)
      VALUES ($1, $2, $3, 'pending')
    `, [prospectId, replyId, dueDate]);
  } finally {
    client.release();
  }
}

/**
 * Main webhook handler
 */
app.post('/webhooks/resend/reply', async (req, res) => {
  try {
    // Verify signature
    if (!verifySignature(req, RESEND_WEBHOOK_SECRET)) {
      console.warn('Invalid webhook signature');
      return res.status(401).send('Invalid signature');
    }
    
    // Parse payload
    let payload;
    try {
      payload = JSON.parse(req.rawBody.toString());
    } catch (e) {
      console.error('Invalid JSON:', e);
      return res.status(400).send('Invalid JSON');
    }
    
    // Resend reply payload structure:
    // {
    //   "type": "email.reply",
    //   "data": {
    //     "from": "sender@example.com",
    //     "to": ["skyler@letsmakeai.fun"],
    //     "subject": "Re: Your email",
    //     "text": "Reply body...",
    //     "html": "<p>Reply body...</p>",
    //     "message_id": "<msg-id@example.com>",
    //     "created_at": "2024-01-15T10:30:00Z"
    //   }
    // }
    
    if (payload.type !== 'email.received') {
      console.log('Ignoring non-reply event:', payload.type);
      return res.status(200).send('OK');
    }
    
    const email = payload.data;
    const fromEmail = email.from?.toLowerCase().trim();
    const subject = email.subject || '';
    const body = email.text || email.html || '';
    const receivedAt = email.created_at ? new Date(email.created_at) : new Date();
    const messageId = email.message_id || null;
    
    if (!fromEmail) {
      console.warn('Reply missing from address');
      return res.status(400).send('Missing from address');
    }
    
    const client = await pool.connect();
    try {
      // Match to prospect by email
      const prospectResult = await client.query(
        'SELECT id, school, state, subject FROM outreach_prospects WHERE LOWER(email) = $1',
        [fromEmail]
      );
      
      const prospect = prospectResult.rows[0] || null;
      
      // Analyze sentiment
      const sentiment = analyzeSentiment(subject, body);
      
      // Store reply
      const replyResult = await client.query(`
        INSERT INTO outreach_replies (
          prospect_id, from_email, subject, body, received_at,
          sentiment, reply_to_email_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        prospect?.id || null,
        fromEmail,
        subject,
        body,
        receivedAt,
        sentiment,
        messageId
      ]);
      
      const replyId = replyResult.rows[0].id;
      
      // If positive and matched to prospect, create follow-up
      if (sentiment === 'positive' && prospect) {
        await createFollowup(prospect.id, replyId);
        
        // Mark reply as having follow-up created
        await client.query(`
          UPDATE outreach_replies SET follow_up_created = TRUE WHERE id = $1
        `, [replyId]);
      }
      
      // Send Discord alert
      await sendDiscordAlert(prospect, { from_email: fromEmail, subject, body }, sentiment);
      
      // Forward to monitoring emails
      await forwardReplyToEmails(prospect, { from_email: fromEmail, subject, body, received_at: receivedAt }, sentiment);
      
      console.log(`Reply stored: ${replyId} | Sentiment: ${sentiment} | Prospect: ${prospect?.school || 'unmatched'}`);
      
      return res.status(200).json({ success: true, replyId, sentiment });
      
    } finally {
      client.release();
    }
    
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).send('Internal error');
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'resend-webhook' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Resend webhook handler listening on port ${PORT}`);
  console.log(`Webhook URL: https://your-domain/webhooks/resend/reply`);
});