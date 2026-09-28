import Stripe from 'stripe';
import { getClient } from './db.js';
import { requireAuth } from './auth.js';

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Billing is not configured');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// The HomeworkHelper subscription product this deployment sells. Checkout
// must not accept a $5.99 monthly USD price that belongs to some unrelated
// product that merely matches amount/currency/interval.
export const HOMEWORKHELPER_PRODUCT_ID = process.env.STRIPE_PRODUCT_ID || 'prod_Usuc74WD77FKN2';

export function isMonthlyTargetPrice(price) {
  return !!price?.active && price.unit_amount === 599 && price.currency === 'usd' &&
    price.recurring?.interval === 'month' && price.recurring?.interval_count === 1 &&
    price.product === HOMEWORKHELPER_PRODUCT_ID;
}

export function billingStatus(user, now = Date.now()) {
  const status = user.stripe_subscription_status || user.subscription_status || 'no_subscription';
  const end = status === 'trialing' ? user.stripe_trial_end : user.stripe_current_period_end;
  const hasAccess = ['active', 'trialing'].includes(status) && !!end && new Date(end).getTime() > now;
  const days = date => date ? Math.max(0, Math.ceil((new Date(date).getTime() - now) / 86400000)) : null;
  return {
    subscription_status: status,
    stripe_subscription_status: user.stripe_subscription_status,
    current_period_end: user.stripe_current_period_end,
    trial_end: user.stripe_trial_end,
    trial_days_remaining: status === 'trialing' ? days(user.stripe_trial_end) : null,
    has_access: hasAccess,
    has_customer: !!user.stripe_customer_id,
    is_annual_plan: !!user.stripe_price_id && user.stripe_price_id === process.env.STRIPE_TEACHER_ANNUAL_PRICE_ID,
  };
}

export async function requireSubscription(req, res, next) {
  const user = requireAuth(req, res);
  if (!user) return;
  const client = await getClient();
  try {
    const { rows } = await client.query('SELECT * FROM users WHERE id = $1', [user.id]);
    if (!rows[0]) return res.status(401).json({ error: 'Account not found' });
    if (!billingStatus(rows[0]).has_access) {
      return res.status(402).json({ error: 'An active subscription or trial is required.', code: 'payment_required' });
    }
    next();
  } finally { client.release(); }
}

export function checkoutParameters({ user, customerId, planType = 'monthly', env = process.env }) {
  if (!['monthly', 'annual'].includes(planType)) throw new Error('Invalid plan');
  const price = planType === 'annual' ? env.STRIPE_TEACHER_ANNUAL_PRICE_ID : env.STRIPE_PRICE_ID;
  if (!price) throw new Error('Requested plan is not configured');
  const appUrl = new URL(env.APP_URL);
  if (appUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(appUrl.hostname)) {
    throw new Error('APP_URL must use HTTPS');
  }
  const metadata = { user_id: user.id, plan_type: planType };
  return {
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    success_url: `${appUrl.origin}/settings?billing=success`,
    cancel_url: `${appUrl.origin}/settings?billing=canceled`,
    metadata,
    subscription_data: { metadata, ...(planType === 'monthly' ? { trial_period_days: 7 } : {}) },
    allow_promotion_codes: true,
  };
}

export async function checkoutHandler(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;
  const planType = req.body?.planType || 'monthly';
  if (planType !== 'monthly') return res.status(400).json({ error: 'Invalid plan' });
  // Validate configuration before creating a customer or any other provider resource.
  checkoutParameters({ user, customerId: 'validation', planType });
  const stripe = getStripe();
  const price = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID);
  if (!isMonthlyTargetPrice(price)) {
    return res.status(503).json({ error: 'Monthly checkout is unavailable until the $5.99 USD price is configured.', code: 'PRICE_NOT_CONFIGURED' });
  }
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [user.id]);
    const dbUser = rows[0];
    if (!dbUser) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Account not found' }); }
    if (['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'].includes(dbUser.stripe_subscription_status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Manage your existing subscription in the billing portal.', code: 'SUBSCRIPTION_EXISTS' });
    }
    let customerId = dbUser.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: dbUser.email, metadata: { user_id: user.id } }, { idempotencyKey: `hh_customer_${user.id}` });
      customerId = customer.id;
      await client.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, user.id]);
    }
    const params = checkoutParameters({ user, customerId, planType });
    // Returning subscribers do not receive a second free trial.
    if (dbUser.stripe_trial_end) delete params.subscription_data.trial_period_days;
    const key = `hh_checkout_${user.id}_${planType}_${params.line_items[0].price}_${Math.floor(Date.now() / 1800000)}`;
    const session = await stripe.checkout.sessions.create(params, { idempotencyKey: key });
    await client.query('COMMIT');
    return res.json({ url: session.url, planType });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}

export async function statusHandler(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;
  const client = await getClient();
  try {
    const { rows } = await client.query('SELECT * FROM users WHERE id = $1', [user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Account not found' });
    return res.json(billingStatus(rows[0]));
  } finally { client.release(); }
}

export async function plansHandler(_req, res) {
  const stripe = getStripe();
  const plans = [];
  if (process.env.STRIPE_PRICE_ID) {
    const price = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID);
    if (isMonthlyTargetPrice(price)) {
      plans.push({ id: 'monthly', amount: price.unit_amount, currency: price.currency, interval: 'month', trial_days: 7 });
    }
  }
  return res.json({ plans });
}

export function subscriptionValues(subscription) {
  const item = subscription.items?.data?.[0];
  const iso = value => value ? new Date(value * 1000).toISOString() : null;
  return {
    id: subscription.id,
    customer: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    status: subscription.status,
    price: item?.price?.id || null,
    periodEnd: iso(item?.current_period_end || subscription.current_period_end),
    trialEnd: iso(subscription.trial_end),
  };
}

export async function persistSubscription(client, subscription) {
  const s = subscriptionValues(subscription);
  // subscription_status is a generated column; never assign it directly.
  const result = await client.query(`UPDATE users SET
    stripe_subscription_id = $1, stripe_subscription_status = $2,
    stripe_price_id = $3, stripe_current_period_end = $4,
    stripe_trial_end = $5, stripe_access_period_end = $4, updated_at = NOW()
    WHERE stripe_customer_id = $6 RETURNING id`,
  [s.id, s.status, s.price, s.periodEnd, s.trialEnd, s.customer]);
  if (!result.rowCount) throw new Error('Subscription customer has no account');
}

export async function processBillingEvent(event, stripe, client) {
  await client.query('BEGIN');
  try {
    const claimed = await client.query(`INSERT INTO webhook_events(event_id, event_type)
      VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING event_id`, [event.id, event.type]);
    if (!claimed.rowCount) { await client.query('COMMIT'); return; }
    const object = event.data.object;
    let subscriptionId;
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      subscriptionId = object.subscription;
    } else if (event.type.startsWith('customer.subscription.')) {
      subscriptionId = object.id;
    } else if (['invoice.paid', 'invoice.payment_failed'].includes(event.type)) {
      subscriptionId = object.subscription || object.parent?.subscription_details?.subscription;
    }
    if (subscriptionId) {
      // Read current provider state so delayed events cannot restore stale access.
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await persistSubscription(client, subscription);
    }
    await client.query('COMMIT');
  } catch (err) { await client.query('ROLLBACK'); throw err; }
}
