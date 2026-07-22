# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e.spec.ts >> Critical User Flows >> Signup → Trial → Grade → Export
- Location: tests/e2e.spec.ts:7:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('text=Sign Up, text=Get Started, text=Start Free Trial')

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - img [ref=e7]
    - heading "HomeworkHelper" [level=1] [ref=e9]
    - paragraph [ref=e10]: AI-powered homework grading for teachers
  - generic [ref=e11]:
    - generic [ref=e12]:
      - button "Sign In" [ref=e13]
      - button "Create Account" [ref=e14]
    - generic [ref=e15]:
      - generic [ref=e16]:
        - generic [ref=e17]: Email
        - textbox "Email" [ref=e18]:
          - /placeholder: you@school.edu
      - generic [ref=e19]:
        - generic [ref=e20]: Password
        - textbox "Password" [ref=e21]:
          - /placeholder: ••••••••
        - paragraph [ref=e22]: At least 8 characters
      - generic [ref=e23] [cursor=pointer]:
        - checkbox "Keep me signed in for 30 days" [ref=e24]
        - generic [ref=e25]: Keep me signed in for 30 days
      - button "Sign In" [ref=e26]
    - generic [ref=e29]: OR
    - button "Continue with Google" [ref=e31]:
      - img [ref=e32]
      - text: Continue with Google
    - generic [ref=e37]:
      - paragraph [ref=e38]:
        - text: Don't have an account?
        - button "Create one" [ref=e39]
      - paragraph [ref=e40]:
        - button "Forgot your password?" [ref=e41]
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
> 14 |     await page.click('text=Sign Up, text=Get Started, text=Start Free Trial');
     |                ^ Error: page.click: Test timeout of 30000ms exceeded.
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
  42 |     await expect(page.locator('text=Subscription, text=Billing')).toBeVisible({ timeout: 10000 });
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