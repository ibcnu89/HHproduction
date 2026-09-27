import { getClient } from './db.js';

export const GEMINI_MODEL = 'gemini-3.1-flash-lite';
export const GEMINI_INPUT_USD_PER_MILLION = 0.25;
export const GEMINI_OUTPUT_USD_PER_MILLION = 1.50;

export function estimateGeminiCost(inputTokens = 0, outputTokens = 0) {
  return (Math.max(0, inputTokens) * GEMINI_INPUT_USD_PER_MILLION +
    Math.max(0, outputTokens) * GEMINI_OUTPUT_USD_PER_MILLION) / 1_000_000;
}

export async function recordGeminiUsage({ userId, feature, usage, units = 1, client: externalClient = null }) {
  if (!userId || !feature) return;
  const inputTokens = Number(usage?.promptTokenCount || 0);
  const outputTokens = Number(usage?.candidatesTokenCount || 0) + Number(usage?.thoughtsTokenCount || 0);
  const cost = estimateGeminiCost(inputTokens, outputTokens);
  const client = externalClient || await getClient();
  try {
    await client.query(
      `INSERT INTO ai_usage (user_id, feature, model, input_tokens, output_tokens, units, estimated_cost_usd)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, feature, GEMINI_MODEL, inputTokens, outputTokens, Math.max(1, Number(units) || 1), cost]
    );
  } finally {
    if (!externalClient) client.release();
  }
}

export async function getUsageSummary(userId, client = null) {
  const ownClient = client || await getClient();
  try {
    const { rows } = await ownClient.query(
      `SELECT COUNT(*)::int AS requests,
              COALESCE(SUM(units), 0)::int AS units,
              COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
              COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
              COALESCE(SUM(estimated_cost_usd), 0)::numeric(14, 8) AS estimated_cost_usd
       FROM ai_usage WHERE user_id = $1
         AND created_at >= date_trunc('month', NOW())`,
      [userId]
    );
    return rows[0];
  } finally {
    if (!client) ownClient.release();
  }
}
