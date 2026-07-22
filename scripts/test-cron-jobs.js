#!/usr/bin/env node
/**
 * Test Cron Jobs Script
 * Manually runs each of the 6 cron jobs and verifies they work
 * 
 * Usage: node scripts/test-cron-jobs.js
 * 
 * Required environment variables (from Railway/GitHub secrets):
 * - DATABASE_URL
 * - STRIPE_SECRET_KEY
 * - STRIPE_WEBHOOK_SECRET
 * - RESEND_API_KEY
 * - DISCORD_OPS_WEBHOOK
 * - APP_URL
 */

import { spawn } from 'child_process';
import fetch from 'node-fetch';

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function logInfo(message) { log(colors.cyan, `ℹ️  ${message}`); }
function logSuccess(message) { log(colors.green, `✅ ${message}`); }
function logError(message) { log(colors.red, `❌ ${message}`); }
function logWarning(message) { log(colors.yellow, `⚠️  ${message}`); }
function logStep(message) { log(colors.bold + colors.blue, `\n▶ ${message}`); }

// Required environment variables
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'DISCORD_OPS_WEBHOOK',
  'APP_URL',
];

// Cron jobs to test
const CRON_JOBS = [
  {
    id: 'daily-health-check',
    name: 'Daily Health Check (6 AM)',
    type: 'http',
    endpoint: 'https://hhproduction-production.up.railway.app/health',
    expectedStatus: 200,
  },
  {
    id: 'webhook-verify',
    name: 'Webhook Verify (every 15 min)',
    type: 'script',
    script: 'scripts/ops/test-webhook.js',
    expectedOutput: 'Webhook test PASSED',
  },
  {
    id: 'mrr-snapshot',
    name: 'MRR Snapshot (midnight)',
    type: 'script',
    script: 'scripts/ops/mrr-snapshot.js',
    expectedOutput: 'MRR Snapshot:',
  },
  {
    id: 'trial-expiry-notify',
    name: 'Trial Expiry Notify (9 AM)',
    type: 'script',
    script: 'scripts/ops/trial-expiry-notify.js',
    expectedOutput: 'Trial expiry',
  },
  {
    id: 'outreach-batch',
    name: 'Outreach Batch (Mon-Fri 10 AM)',
    type: 'script',
    script: 'scripts/ops/send-outreach-batch.js',
    expectedOutput: 'Outreach Batch Complete',
  },
  {
    id: 'content-publish',
    name: 'Content Publish (Mon 9 AM)',
    type: 'script',
    script: 'scripts/ops/publish-scheduled-content.js',
    expectedOutput: 'Content Publish',
  },
];

// Test results storage
const results = [];

// Discord alert function
async function sendDiscordAlert(title, description, level = 'info', fields = []) {
  const webhookUrl = process.env.DISCORD_OPS_WEBHOOK;
  if (!webhookUrl) {
    logWarning('DISCORD_OPS_WEBHOOK not set, skipping Discord alert');
    return false;
  }

  const COLORS = { info: 0x3b82f6, success: 0x22c55e, warning: 0xf59e0b, critical: 0xef4444 };
  const EMOJIS = { info: 'ℹ️', success: '✅', warning: '⚠️', critical: '🚨' };

  const embed = {
    title: `${EMOJIS[level]} ${title}`,
    description,
    color: COLORS[level],
    timestamp: new Date().toISOString(),
    footer: { text: 'HHproduction Cron Test' },
    fields: fields.map(f => ({ name: f.name, value: f.value, inline: f.inline ?? true })),
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
    return response.ok;
  } catch (err) {
    console.error('[Discord Alert] Error:', err.message);
    return false;
  }
}

// Run a shell command and capture output
function runCommand(command, args = [], env = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    child.on('error', (err) => {
      resolve({ code: -1, stdout, stderr: err.message });
    });
  });
}

// Make HTTP request
async function httpRequest(url, expectedStatus = 200) {
  try {
    const response = await fetch(url, { method: 'GET' });
    const text = await response.text();
    return {
      success: response.status === expectedStatus,
      status: response.status,
      body: text,
    };
  } catch (err) {
    return {
      success: false,
      status: 0,
      body: err.message,
    };
  }
}

// Run a single cron job test
async function runCronJob(job) {
  logStep(`Testing: ${job.name}`);
  const startTime = Date.now();

  let result = {
    id: job.id,
    name: job.name,
    passed: false,
    exitCode: null,
    output: '',
    error: null,
    duration: 0,
  };

  try {
    if (job.type === 'http') {
      // HTTP health check
      logInfo(`Calling ${job.endpoint}...`);
      const response = await httpRequest(job.endpoint, job.expectedStatus);
      result.exitCode = response.success ? 0 : 1;
      result.output = `Status: ${response.status}\n${response.body.substring(0, 500)}`;
      result.passed = response.success;

      if (response.success) {
        logSuccess(`${job.name} - HTTP ${response.status} OK`);
      } else {
        logError(`${job.name} - HTTP ${response.status} FAILED`);
        logError(`Response: ${response.body.substring(0, 200)}`);
      }
    } else if (job.type === 'script') {
      // Run Node.js script
      logInfo(`Running node ${job.script}...`);
      const execResult = await runCommand('node', [job.script]);
      result.exitCode = execResult.code;
      result.output = execResult.stdout + (execResult.stderr ? `\nSTDERR:\n${execResult.stderr}` : '');
      result.passed = execResult.code === 0 && 
        (execResult.stdout.includes(job.expectedOutput) || execResult.stderr.includes(job.expectedOutput));

      if (result.passed) {
        logSuccess(`${job.name} - Exit code 0, expected output found`);
      } else {
        logError(`${job.name} - Exit code ${execResult.code}`);
        if (execResult.stdout) logError(`STDOUT: ${execResult.stdout.substring(0, 500)}`);
        if (execResult.stderr) logError(`STDERR: ${execResult.stderr.substring(0, 500)}`);
      }
    }
  } catch (err) {
    result.passed = false;
    result.error = err.message;
    result.exitCode = -1;
    logError(`${job.name} - Error: ${err.message}`);
  }

  result.duration = Date.now() - startTime;
  results.push(result);
  return result;
}

// Check required environment variables
function checkEnvVars() {
  logStep('Checking required environment variables...');
  const missing = [];
  
  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
      logError(`Missing: ${varName}`);
    } else {
      logSuccess(`Found: ${varName}`);
    }
  }

  if (missing.length > 0) {
    logError(`\n❌ Missing ${missing.length} required environment variable(s):`);
    missing.forEach(m => logError(`  - ${m}`));
    logInfo('\nPlease set these from Railway/GitHub secrets before running.');
    return false;
  }
  
  logSuccess('\nAll required environment variables are set!');
  return true;
}

// Print summary
function printSummary() {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  log(colors.bold + colors.blue, '\n═══════════════════════════════════════');
  log(colors.bold + colors.blue, '        CRON JOB TEST SUMMARY');
  log(colors.bold + colors.blue, '═══════════════════════════════════════');

  for (const result of results) {
    const status = result.passed ? colors.green + 'PASS' : colors.red + 'FAIL';
    const duration = `${(result.duration / 1000).toFixed(1)}s`;
    log(`${status}${colors.reset}  ${result.name} (${duration})`);
    if (!result.passed && result.output) {
      log(colors.red, `      Exit: ${result.exitCode}`);
      log(colors.red, `      Output: ${result.output.substring(0, 200)}...`);
    }
  }

  log(colors.bold + colors.blue, '═══════════════════════════════════════');
  const summaryColor = failed === 0 ? colors.green : colors.red;
  log(summaryColor + colors.bold, `\nTotal: ${total} | Passed: ${passed} | Failed: ${failed}`);
  log(colors.bold + colors.blue, '═══════════════════════════════════════\n');

  return { passed, failed, total };
}

// Send Discord summary
async function sendDiscordSummary(summary) {
  const fields = results.map(r => ({
    name: r.name,
    value: r.passed ? '✅ PASS' : '❌ FAIL',
    inline: true,
  }));

  const level = summary.failed === 0 ? 'success' : 'warning';
  const title = summary.failed === 0 ? 'All Cron Jobs Passed ✅' : `Cron Job Tests: ${summary.failed} Failed`;

  await sendDiscordAlert(
    title,
    `Ran ${summary.total} cron job tests\nPassed: ${summary.passed} | Failed: ${summary.failed}`,
    level,
    fields
  );
}

// Main function
async function main() {
  log(colors.bold + colors.cyan, '\n╔══════════════════════════════════════╗');
  log(colors.bold + colors.cyan, '║  HHproduction Cron Job Test Suite  ║');
  log(colors.bold + colors.cyan, '╚══════════════════════════════════════╝\n');

  // Check environment variables
  if (!checkEnvVars()) {
    process.exit(1);
  }

  logStep(`Starting ${CRON_JOBS.length} cron job tests...\n`);

  // Run each cron job
  for (const job of CRON_JOBS) {
    await runCronJob(job);
    // Small delay between tests
    await new Promise(r => setTimeout(r, 500));
  }

  // Print summary
  const summary = printSummary();

  // Send Discord alert
  logInfo('Sending Discord summary...');
  await sendDiscordSummary(summary);

  // Exit with appropriate code
  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});