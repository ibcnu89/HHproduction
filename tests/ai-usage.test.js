import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateGeminiCost, recordGeminiUsage, getUsageSummary } from '../lib/ai-usage.js';

test('Gemini cost estimate uses the documented input and output rates', () => {
  assert.equal(estimateGeminiCost(1_000_000, 1_000_000), 1.75);
  assert.equal(estimateGeminiCost(-1, 10), 0.000015);
});

test('records provider usage metadata and summarizes current month', async () => {
  const writes = [];
  const client = { async query(sql, params) {
    if (sql.includes('INSERT INTO ai_usage')) { writes.push(params); return { rows: [], rowCount: 1 }; }
    return { rows: [{ requests: 1, units: 1, input_tokens: 100, output_tokens: 50, estimated_cost_usd: '0.00010000' }] };
  } };
  await recordGeminiUsage({ userId: 'user-1', feature: 'grading', usage: { promptTokenCount: 100, candidatesTokenCount: 40, thoughtsTokenCount: 10 }, client });
  assert.deepEqual(writes[0], ['user-1', 'grading', 'gemini-3.1-flash-lite', 100, 50, 1, 0.0001]);
  assert.equal((await getUsageSummary('user-1', client)).input_tokens, 100);
});
