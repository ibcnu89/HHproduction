#!/usr/bin/env node
/**
 * Create Stripe Product and Price for HomeworkHelper Pro
 * Run: node scripts/create-stripe-product.js
 * Requires STRIPE_SECRET_KEY in environment
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

  console.log('🔨 Creating Stripe Product: HomeworkHelper Pro...');
  
  // Create Product
  const product = await stripe.products.create({
    name: 'HomeworkHelper Pro',
    description: 'Unlimited AI grading for teachers — all subjects, all grade levels, custom rubrics, OCR handwriting extraction',
    metadata: {
      product_tier: 'pro',
      app: 'homeworkhelper',
    },
  });
  
  console.log(`✅ Product created: ${product.id}`);
  
  // Create Price - $20/month recurring
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 2000, // $20.00 in cents
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
  
  console.log('\n📋 Add these to Vercel Environment Variables:');
    console.log(`STRIPE_PRICE_ID=${price.id}`);
    console.log(`STRIPE_SECRET_KEY=sk_live_**** (hidden)`);

    console.log('\n🔗 Next steps:');
  console.log('1. Add STRIPE_PRICE_ID to Vercel env vars');
  console.log('2. Run database migration: node migrate-billing.js');
  console.log('3. Set STRIPE_WEBHOOK_SECRET after registering webhook endpoint');
  console.log('4. Deploy and test!');
  
  return { product, price };
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});