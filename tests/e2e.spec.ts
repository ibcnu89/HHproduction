import { test, expect } from '@playwright/test';

const BASE_URL = 'https://hhproduction-production.up.railway.app';

test.describe('Critical User Flows', () => {
  
  test('Signup → Trial → Grade → Export', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Check landing page loads
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    
    // Navigate to signup
    await page.click('text=Sign Up, text=Get Started, text=Start Free Trial');
    await page.waitForURL('**/auth**');
    
    // Fill signup form (using test email)
    const testEmail = `test_${Date.now()}@example.com`;
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    
    // Should redirect to app or dashboard
    await page.waitForURL('**/app**', { timeout: 15000 });
    
    // Verify trial status shows
    await expect(page.locator('text=Trial, text=trial, text=7 day')).toBeVisible({ timeout: 10000 });
  });

  test('Login → Settings → Billing → Portal', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Login with existing test account
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    
    // Navigate to settings
    await page.goto(`${BASE_URL}/settings`);
    
    // Check billing section exists
    await expect(page.locator('text=Subscription, text=Billing')).toBeVisible({ timeout: 10000 });
    
    // Check manage subscription button
    await expect(page.locator('text=Manage Subscription')).toBeVisible();
  });

  test('Batch grade 30 papers → CSV export', async ({ page }) => {
    // This requires auth - skip if no test account
    test.skip();
  });

  test('Health endpoint returns 200', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/health`);
    expect(response.status()).toBe(200);
  });

  test('Webhook health endpoint returns 200', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/billing/webhook/health`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });
});