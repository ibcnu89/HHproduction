#!/usr/bin/env node
/**
 * Expire Annual Plans Cron Job
 * Runs daily to check for annual plans that have expired (9 months elapsed)
 * Updates subscription_status to 'expired' for those users
 */

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function expireAnnualPlans() {
  const client = await pool.connect();
  try {
    console.log('[Expire Annual Plans] Starting check...');
    
    // Find all users with active annual plans that have expired
    const result = await client.query(`
      SELECT id, email, stripe_subscription_id, stripe_current_period_end
      FROM users
      WHERE stripe_subscription_id LIKE 'annual_%'
        AND subscription_status = 'active'
        AND stripe_current_period_end < NOW()
    `);

    if (result.rowCount === 0) {
      console.log('[Expire Annual Plans] No expired annual plans found');
      return;
    }

    console.log(`[Expire Annual Plans] Found ${result.rowCount} expired annual plan(s)`);

    for (const user of result.rows) {
      await client.query(
        `UPDATE users SET
           subscription_status = 'expired',
           stripe_subscription_status = 'expired',
           updated_at = NOW()
         WHERE id = $1`,
        [user.id]
      );
      console.log(`[Expire Annual Plans] Expired annual plan for user ${user.id} (${user.email})`);
    }

    console.log('[Expire Annual Plans] Completed');
  } catch (error) {
    console.error('[Expire Annual Plans] Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

expireAnnualPlans()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });