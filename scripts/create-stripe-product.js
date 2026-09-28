#!/usr/bin/env node
/**
 * Create Stripe Product and Price for the HomeworkHelper subscription.
 * Run: node scripts/create-stripe-product.js
 * Requires STRIPE_SECRET_KEY in environment.
 *
 * ⚠️ OPERATOR NOTE: production already has product prod_Usuc74WD77FKN2
 * ("HomeworkHelper") with the live $5.99/month price. Running this script
 * creates NEW duplicate objects — do NOT run it against the production
 * account unless you intend to replace the billing configuration; wire
 * the resulting STRIPE_PRICE_ID into Railway and update
 * HOMEWORKHELPER_PRODUCT_ID in lib/billing.js if you do.
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ STRIPE_SECRET_KEY not set in environment');
    process.exit(1);
  }

  console.log('🔨 Creating Stripe Product: HomeworkHelper...');
  
  // Create Product
  const product = await stripe.products.create({
    name: 'HomeworkHelper',
    description: 'Unlimited AI grading for teachers — all subjects, all grade levels, custom rubrics, OCR handwriting extraction',
    metadata: {
      product_tier: 'pro',
      app: 'homeworkhelper',
    },
  });
  
  console.log(`✅ Product created: ${product.id}`);
  
  // Create Price - $5.99/month recurring (the current intended plan)
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 599, // $5.99 in cents
    currency: 'usd',
    recurring: {
      interval: 'month',
      interval_count: 1,
    },
    metadata: {
      tier: 'pro',
      interval: 'monthly',
    },
  });
  
  console.log(`✅ Price created: ${price.id}`);
  console.log(`💰 Amount: $${(price.unit_amount / 100).toFixed(2)}/${price.recurring.interval}`);
  
  console.log('\n📋 Add these to Railway Environment Variables:');
  console.log(`STRIPE_PRICE_ID=${price.id}`);
  console.log('STRIPE_SECRET_KEY=sk_live_**** (hidden)');

  console.log('\n🔗 Next steps:');
  console.log('1. Add STRIPE_PRICE_ID to the Railway service variables');
  console.log('2. Set STRIPE_WEBHOOK_SECRET after registering the webhook endpoint');
  console.log('3. Update STRIPE_PRODUCT_ID if the product ID changed');
  console.log('4. Deploy and test!');
  
  return { product, price };
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});