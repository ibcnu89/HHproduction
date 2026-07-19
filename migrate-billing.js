import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const sql = `
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_current_period_end TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS stripe_trial_end TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) GENERATED ALWAYS AS (
    CASE
      WHEN stripe_subscription_status IS NULL THEN 'no_subscription'
      WHEN stripe_subscription_status = 'trialing' THEN 'trialing'
      WHEN stripe_subscription_status = 'active' THEN 'active'
      WHEN stripe_subscription_status = 'past_due' THEN 'past_due'
      WHEN stripe_subscription_status = 'canceled' THEN 'canceled'
      WHEN stripe_subscription_status = 'unpaid' THEN 'unpaid'
      ELSE stripe_subscription_status
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id ON users(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
`;

pool.query(sql)
  .then(() => { console.log('Migration complete'); pool.end(); })
  .catch(e => { console.error(e); pool.end(); process.exit(1); });