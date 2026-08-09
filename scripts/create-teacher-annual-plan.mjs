import { Stripe } from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

async function createTeacherAnnualPlan() {
  try {
    // Check if product already exists
    const products = await stripe.products.list({ limit: 100 });
    let product = products.data.find(p => p.name === 'Teacher Annual Plan');
    
    if (!product) {
      product = await stripe.products.create({
        name: 'Teacher Annual Plan',
        description: 'Annual billing, 9 months of access per year (summer off). $150/year, renews annually on purchase date.',
        metadata: {
          plan_type: 'teacher_annual',
          access_months_per_year: '9',
        },
      });
      console.log('Product created:', product.id);
    } else {
      console.log('Product exists:', product.id);
    }
    
    // Check if annual price exists
    const prices = await stripe.prices.list({ product: product.id, limit: 100 });
    let price = prices.data.find(p => 
      p.unit_amount === 15000 && 
      p.currency === 'usd' && 
      p.recurring?.interval === 'year'
    );
    
    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: 15000, // $150.00
        currency: 'usd',
        recurring: {
          interval: 'year',
          interval_count: 1,
        },
        metadata: {
          plan_type: 'teacher_annual',
          access_months_per_year: '9',
        },
      });
      console.log('Price created:', price.id);
    } else {
      console.log('Price exists:', price.id);
    }
    
    console.log('\nAdd to Railway env:');
    console.log(`STRIPE_TEACHER_ANNUAL_PRICE_ID=${price.id}`);
    console.log(`STRIPE_TEACHER_ANNUAL_PRODUCT_ID=${product.id}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createTeacherAnnualPlan();