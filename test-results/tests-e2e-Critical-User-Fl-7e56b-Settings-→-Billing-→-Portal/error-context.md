# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e.spec.ts >> Critical User Flows >> Login → Settings → Billing → Portal
- Location: tests/e2e.spec.ts:30:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Subscription, text=Billing')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=Subscription, text=Billing')

```

```yaml
- img
- heading "HomeworkHelper" [level=1]
- paragraph: AI-powered homework grading for teachers
- button "Sign In"
- button "Create Account"
- text: Email
- textbox "Email":
  - /placeholder: you@school.edu
- text: Password
- textbox "Password":
  - /placeholder: ••••••••
- paragraph: At least 8 characters
- checkbox "Keep me signed in for 30 days"
- text: Keep me signed in for 30 days
- button "Sign In"
- text: OR
- button "Continue with Google":
  - img
  - text: Continue with Google
- paragraph:
  - text: Don't have an account?
  - button "Create one"
- paragraph:
  - button "Forgot your password?"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const BASE_URL = 'https://hhproduction-production.up.railway.app';
  4  | 
  5  | test.describe('Critical User Flows', () => {
  6  |   
  7  |   test('Signup → Trial → Grade → Export', async ({ page }) => {
  8  |     await page.goto(BASE_URL);
  9  |     
  10 |     // Check landing page loads
  11 |     await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  12 |     
  13 |     // Navigate to signup
  14 |     await page.click('text=Sign Up, text=Get Started, text=Start Free Trial');
  15 |     await page.waitForURL('**/auth**');
  16 |     
  17 |     // Fill signup form (using test email)
  18 |     const testEmail = `test_${Date.now()}@example.com`;
  19 |     await page.fill('input[type="email"]', testEmail);
  20 |     await page.fill('input[type="password"]', 'TestPass123!');
  21 |     await page.click('button[type="submit"]');
  22 |     
  23 |     // Should redirect to app or dashboard
  24 |     await page.waitForURL('**/app**', { timeout: 15000 });
  25 |     
  26 |     // Verify trial status shows
  27 |     await expect(page.locator('text=Trial, text=trial, text=7 day')).toBeVisible({ timeout: 10000 });
  28 |   });
  29 | 
  30 |   test('Login → Settings → Billing → Portal', async ({ page }) => {
  31 |     await page.goto(`${BASE_URL}/login`);
  32 |     
  33 |     // Login with existing test account
  34 |     await page.fill('input[type="email"]', 'test@example.com');
  35 |     await page.fill('input[type="password"]', 'TestPass123!');
  36 |     await page.click('button[type="submit"]');
  37 |     
  38 |     // Navigate to settings
  39 |     await page.goto(`${BASE_URL}/settings`);
  40 |     
  41 |     // Check billing section exists
> 42 |     await expect(page.locator('text=Subscription, text=Billing')).toBeVisible({ timeout: 10000 });
     |                                                                   ^ Error: expect(locator).toBeVisible() failed
  43 |     
  44 |     // Check manage subscription button
  45 |     await expect(page.locator('text=Manage Subscription')).toBeVisible();
  46 |   });
  47 | 
  48 |   test('Batch grade 30 papers → CSV export', async ({ page }) => {
  49 |     // This requires auth - skip if no test account
  50 |     test.skip();
  51 |   });
  52 | 
  53 |   test('Health endpoint returns 200', async ({ request }) => {
  54 |     const response = await request.get(`${BASE_URL}/health`);
  55 |     expect(response.status()).toBe(200);
  56 |   });
  57 | 
  58 |   test('Webhook health endpoint returns 200', async ({ request }) => {
  59 |     const response = await request.get(`${BASE_URL}/api/billing/webhook/health`);
  60 |     expect(response.status()).toBe(200);
  61 |     const body = await response.json();
  62 |     expect(body.status).toBe('ok');
  63 |   });
  64 | });
```