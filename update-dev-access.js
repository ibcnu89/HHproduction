
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function updateDevAccess() {
  const client = await pool.connect();
  try {
    // Check current users
    const result = await client.query(
      "SELECT email, subscription_status, stripe_subscription_status, stripe_current_period_end FROM users WHERE email IN ('ibcnu89@gmail.com', 'sgirten69@gmail.com')"
    );
    console.log('BEFORE:', JSON.stringify(result.rows, null, 2));
    
    // Update sgirten69@gmail.com to have active subscription
    await client.query(
      "UPDATE users SET stripe_subscription_status = 'active', stripe_current_period_end = NOW() + INTERVAL '10 years', stripe_customer_id = 'cus_V1ZU8AgrqDx3fF', stripe_subscription_id = 'dev_sub_sgirten69' WHERE email = 'sgirten69@gmail.com'"
    );
    
    // Verify
    const after = await client.query(
      "SELECT email, subscription_status, stripe_subscription_status, stripe_current_period_end FROM users WHERE email IN ('ibcnu89@gmail.com', 'sgirten69@gmail.com')"
    );
    console.log('AFTER:', JSON.stringify(after.rows, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

updateDevAccess().catch(console.error);
