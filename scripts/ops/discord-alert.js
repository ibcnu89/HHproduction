/**
 * Discord Alert Utility
 * Send formatted alerts to Discord webhook
 * Usage: await alert('Title', 'Description', 'warning') // 'info' | 'warning' | 'critical' | 'success'
 */

const WEBHOOK_URL = process.env.DISCORD_OPS_WEBHOOK;

const COLORS = {
  info: 0x3b82f6,      // blue
  success: 0x22c55e,   // green
  warning: 0xf59e0b,   // amber
  critical: 0xef4444,  // red
};

const EMOJIS = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  critical: '🚨',
};

/**
 * Send alert to Discord
 * @param {string} title - Alert title
 * @param {string} description - Alert details
 * @param {'info'|'success'|'warning'|'critical'} level - Severity level
 * @param {Object} fields - Optional additional fields { name, value, inline }
 */
export async function alert(title, description, level = 'info', fields = []) {
  if (!WEBHOOK_URL) {
    console.warn('[Discord Alert] No DISCORD_OPS_WEBHOOK configured');
    return false;
  }

  const embed = {
    title: `${EMOJIS[level]} ${title}`,
    description,
    color: COLORS[level],
    timestamp: new Date().toISOString(),
    footer: { text: 'HHproduction Ops' },
    fields: fields.map(f => ({ name: f.name, value: f.value, inline: f.inline ?? true })),
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Discord Alert] Failed:', response.status, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Discord Alert] Error:', err.message);
    return false;
  }
}

/**
 * Convenience wrappers
 */
export const info = (title, desc, fields) => alert(title, desc, 'info', fields);
export const success = (title, desc, fields) => alert(title, desc, 'success', fields);
export const warning = (title, desc, fields) => alert(title, desc, 'warning', fields);
export const critical = (title, desc, fields) => alert(title, desc, 'critical', fields);

/**
 * Test the webhook
 */
export async function test() {
  return await info('HHproduction Ops Test', 'Discord webhook configured correctly ✅');
}