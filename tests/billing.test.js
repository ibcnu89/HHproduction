import test from 'node:test';
import assert from 'node:assert/strict';
import { billingStatus, checkoutParameters, subscriptionValues, processBillingEvent, isMonthlyTargetPrice, HOMEWORKHELPER_PRODUCT_ID } from '../lib/billing.js';

const now = Date.parse('2026-09-26T12:00:00Z');
test('expired trials and expired paid periods do not grant access', () => {
  for (const status of ['trialing', 'active']) {
    const user = { stripe_subscription_status: status, stripe_trial_end: new Date(now - 1), stripe_current_period_end: new Date(now - 1) };
    assert.equal(billingStatus(user, now).has_access, false);
    user.stripe_trial_end = user.stripe_current_period_end = new Date(now + 10000);
    assert.equal(billingStatus(user, now).has_access, true);
  }
  for (const status of ['canceled', 'past_due', 'unpaid', 'incomplete', 'no_subscription']) {
    assert.equal(billingStatus({ stripe_subscription_status: status, stripe_current_period_end: new Date(now + 10000) }, now).has_access, false);
  }
});

test('checkout selects the configured interval and requires a valid plan', () => {
  const input = { user: { id: 'teacher' }, customerId: 'cus_test', env: { APP_URL: 'https://example.test', STRIPE_PRICE_ID: 'price_month', STRIPE_TEACHER_ANNUAL_PRICE_ID: 'price_year' } };
  const monthly = checkoutParameters(input);
  assert.equal(monthly.line_items[0].price, 'price_month');
  assert.equal(monthly.subscription_data.trial_period_days, 7);
  assert.equal(monthly.payment_method_types, undefined);
  const annual = checkoutParameters({ ...input, planType: 'annual' });
  assert.equal(annual.line_items[0].price, 'price_year');
  assert.equal(annual.subscription_data.trial_period_days, undefined);
  assert.throws(() => checkoutParameters({ ...input, planType: 'invalid' }), /Invalid plan/);
});

test('configured monthly checkout price must be active at exactly USD 5.99/month on the HomeworkHelper product', () => {
  const target = { active: true, unit_amount: 599, currency: 'usd', recurring: { interval: 'month', interval_count: 1 }, product: HOMEWORKHELPER_PRODUCT_ID };
  assert.equal(isMonthlyTargetPrice(target), true);
  assert.equal(isMonthlyTargetPrice({ ...target, unit_amount: 2000 }), false);
  assert.equal(isMonthlyTargetPrice({ ...target, currency: 'cad' }), false);
  assert.equal(isMonthlyTargetPrice({ ...target, recurring: { interval: 'year', interval_count: 1 } }), false);
  assert.equal(isMonthlyTargetPrice({ ...target, active: false }), false);
  assert.equal(isMonthlyTargetPrice({ ...target, product: 'prod_unrelated' }), false);
});

test('supports item-level billing periods and retains a real trial status', () => {
  const s = subscriptionValues({ id: 'sub_test', customer: 'cus_test', status: 'trialing', trial_end: now / 1000 + 60, items: { data: [{ current_period_end: now / 1000 + 60, price: { id: 'price_test' } }] } });
  assert.equal(s.status, 'trialing');
  assert.equal(s.periodEnd, new Date(now + 60000).toISOString());
});

test('webhook duplicate is skipped and failure rolls back for retry', async () => {
  const event = { id: 'evt_test', type: 'customer.subscription.updated', data: { object: { id: 'sub_test' } } };
  const calls = [];
  let claimed = false;
  const client = { query: async sql => { calls.push(sql); return { rowCount: sql.startsWith('INSERT') ? Number(claimed) : 1 }; } };
  const stripe = { subscriptions: { retrieve: async () => { throw new Error('provider unavailable'); } } };
  await processBillingEvent(event, stripe, client);
  assert.equal(calls.at(-1), 'COMMIT');
  claimed = true;
  await assert.rejects(processBillingEvent(event, stripe, client), /provider unavailable/);
  assert.equal(calls.at(-1), 'ROLLBACK');
});

test('checkout price gate rejects a $5.99 monthly price on an unrelated product', async () => {
  const { isMonthlyTargetPrice, HOMEWORKHELPER_PRODUCT_ID } = await import('../lib/billing.js');
  const good = { active: true, unit_amount: 599, currency: 'usd', recurring: { interval: 'month', interval_count: 1 }, product: HOMEWORKHELPER_PRODUCT_ID };
  assert.equal(isMonthlyTargetPrice(good), true);
  // Same amount/currency/interval but a foreign product must fail:
  const imposter = { ...good, product: 'prod_someOtherProduct' };
  assert.equal(isMonthlyTargetPrice(imposter), false, 'foreign product must be rejected');
  // Missing product must fail closed:
  const noProduct = { active: true, unit_amount: 599, currency: 'usd', recurring: { interval: 'month', interval_count: 1 } };
  assert.equal(isMonthlyTargetPrice(noProduct), false, 'missing product must fail closed');
  // Wrong amount still rejected:
  const old20 = { active: true, unit_amount: 2000, currency: 'usd', recurring: { interval: 'month', interval_count: 1 }, product: HOMEWORKHELPER_PRODUCT_ID };
  assert.equal(isMonthlyTargetPrice(old20), false, 'old $20 price must be rejected');
});
