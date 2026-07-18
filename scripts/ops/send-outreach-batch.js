#!/usr/bin/env node
/**
 * Send Outreach Batch - Daily cron (Mon-Fri 10 AM)
 * Sends personalized cold emails to teacher prospects
 * Run: 0 10 * * 1-5
 */

import pg from 'pg';
import { Resend } from 'resend';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const resend = new Resend(process.env.RESEND_API_KEY);

// Discord alert utility
const WEBHOOK_URL = process.env.DISCORD_OPS_WEBHOOK;
const COLORS = { info: 0x3b82f6, success: 0x22c55e, warning: 0xf59e0b, critical: 0xef4444 };
const EMOJIS = { info: 'ℹ️', success: '✅', warning: '⚠️', critical: '🚨' };

async function sendDiscordAlert(title, description, level = 'info', fields = []) {
  if (!WEBHOOK_URL) return;
  const embed = {
    title: `${EMOJIS[level]} ${title}`,
    description,
    color: COLORS[level],
    timestamp: new Date().toISOString(),
    footer: { text: 'HHproduction Ops' },
    fields: fields.map(f => ({ name: f.name, value: f.value, inline: f.inline ?? true })),
  };
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (err) {
    console.error('[Discord Alert] Failed:', err.message);
  }
}

const OUTREACH_TEMPLATES = [
  {
    subject: "Quick question about your grading workload",
    html: `
      <p>Hi {{first_name}},</p>
      <p>I noticed you teach {{subject}} at {{school}} — respect. That's a lot of papers.</p>
      <p>I built an AI tool that grades handwritten homework against state standards in seconds. Teachers using it cut grading time by ~80%.</p>
      <p>Free 7-day trial, no commitment. Want me to send a 60-second demo video?</p>
      <p>— Skyler<br>HomeworkHelper</p>
    `,
    text: `Hi {{first_name}},\n\nI noticed you teach {{subject}} at {{school}} — respect. That's a lot of papers.\n\nI built an AI tool that grades handwritten homework against state standards in seconds. Teachers using it cut grading time by ~80%.\n\nFree 7-day trial, no commitment. Want me to send a 60-second demo video?\n\n— Skyler\nHomeworkHelper`
  },
  {
    subject: "Your Tuesday night grading pile",
    html: `
      <p>Hi {{first_name}},</p>
      <p>Tuesday night. Stack of {{subject}} papers. Netflix waiting.</p>
      <p>What if you could snap a photo of each paper and get standards-aligned grades + feedback in 30 seconds?</p>
      <p>That's what HomeworkHelper does. Illinois Learning Standards, custom rubrics, handwriting OCR.</p>
      <p>7-day free trial. Cancel anytime. <a href="https://hhproduction-production.up.railway.app">Try it here</a>.</p>
      <p>— Skyler</p>
    `,
    text: `Hi {{first_name}},\n\nTuesday night. Stack of {{subject}} papers. Netflix waiting.\n\nWhat if you could snap a photo of each paper and get standards-aligned grades + feedback in 30 seconds?\n\nThat's what HomeworkHelper does. Illinois Learning Standards, custom rubrics, handwriting OCR.\n\n7-day free trial. Cancel anytime. https://hhproduction-production.up.railway.app\n\n— Skyler`
  }
];

async function main() {
  const client = await pool.connect();
  try {
    // Get prospects who haven't been contacted in 30 days
    const prospects = await client.query(`
      SELECT * FROM outreach_prospects
      WHERE status = 'new'
        AND (last_contacted IS NULL OR last_contacted < NOW() - INTERVAL '30 days')
      ORDER BY RANDOM()
      LIMIT 20
    `);

    if (prospects.rows.length === 0) {
      console.log('No prospects to contact');
      await sendDiscordAlert('Outreach Batch Complete', 'No prospects to contact today', 'info');
      return;
    }

    const template = OUTREACH_TEMPLATES[Math.floor(Math.random() * OUTREACH_TEMPLATES.length)];
    let sent = 0;
    let failed = 0;

    for (const prospect of prospects.rows) {
      const personalizedHtml = template.html
        .replace(/{{first_name}}/g, prospect.first_name || 'there')
        .replace(/{{subject}}/g, prospect.subject || 'your class')
        .replace(/{{school}}/g, prospect.school || 'your school');

      const personalizedText = template.text
        .replace(/{{first_name}}/g, prospect.first_name || 'there')
        .replace(/{{subject}}/g, prospect.subject || 'your class')
        .replace(/{{school}}/g, prospect.school || 'your school');

      try {
        await resend.emails.send({
          from: 'Skyler @ HomeworkHelper <skyler@hhproduction.com>',
          to: prospect.email,
          subject: template.subject,
          html: personalizedHtml,
          text: personalizedText,
        });

        await client.query(`
          UPDATE outreach_prospects
          SET status = 'contacted', last_contacted = NOW(), touch_count = touch_count + 1
          WHERE id = $1
        `, [prospect.id]);

        console.log(`Sent to ${prospect.email}: ${template.subject}`);
        sent++;
      } catch (err) {
        console.error(`Failed to send to ${prospect.email}:`, err.message);
        failed++;
      }

      // Rate limit: 1 second between sends
      await new Promise(r => setTimeout(r, 1000));
    }

    // Send summary Discord alert
    await sendDiscordAlert(
      'Outreach Batch Complete',
      `Sent ${sent} emails, ${failed} failed`,
      failed > 0 ? 'warning' : 'success',
      [
        { name: 'Template', value: template.subject, inline: true },
        { name: 'Sent', value: sent.toString(), inline: true },
        { name: 'Failed', value: failed.toString(), inline: true },
      ]
    );
  } catch (err) {
    console.error('Outreach batch failed:', err);
    await sendDiscordAlert('Outreach Batch Failed', err.message, 'critical');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();