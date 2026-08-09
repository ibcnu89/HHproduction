const pg = require('pg');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createDevAccess() {
  const client = await pool.connect();
  try {
    // First, check if user exists
    const checkResult = await client.query(
      "SELECT id, email, subscription_status, stripe_subscription_status FROM users WHERE email = 'sgirten69@gmail.com'"
    );
    console.log('CHECK:', JSON.stringify(checkResult.rows, null, 2));
    
    let userId;
    if (checkResult.rows.length === 0) {
      // Create user
      const createResult = await client.query(
        "INSERT INTO users (email, google_id, name, email_verified, stripe_customer_id, stripe_subscription_id, stripe_subscription_status, stripe_current_period_end) VALUES ('sgirten69@gmail.com', 'dev_google_id_sgirten69', 'sgirten69', TRUE, 'cus_V1ZU8AgrqDx3fF', 'dev_sub_sgirten69', 'active', NOW() + INTERVAL '10 years') RETURNING id, email"
      );
      userId = createResult.rows[0].id;
      console.log('CREATED:', JSON.stringify(createResult.rows, null, 2));
    } else {
      userId = checkResult.rows[0].id;
      // Update existing user
      await client.query(
        "UPDATE users SET stripe_subscription_status = 'active', stripe_current_period_end = NOW() + INTERVAL '10 years', stripe_customer_id = 'cus_V1ZU8AgrqDx3fF', stripe_subscription_id = 'dev_sub_sgirten69' WHERE email = 'sgirten69@gmail.com'"
      );
      console.log('UPDATED existing user');
    }
    
    // Verify
    const after = await client.query(
      "SELECT email, subscription_status, stripe_subscription_status, stripe_current_period_end FROM users WHERE email IN ('ibcnu89@gmail.com', 'sgirten69@gmail.com')"
    );
    console.log('FINAL:', JSON.stringify(after.rows, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createDevAccess().catch(console.error);