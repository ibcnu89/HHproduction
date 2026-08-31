# MANUAL ACTION REQUIRED FROM SKYLER

This document lists actions that **Hermes cannot safely perform** because they require access to external platforms (Google Cloud Console, Railway dashboard, DNS, etc.).

---

## 1. GOOGLE CLOUD CONSOLE - OAuth 2.0 Credentials

### Platform
Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs → [HHproduction Client ID: `766794428011-iq8mme64vga0bda0r1l2vr2q700uj6mk.apps.googleusercontent.com`]

### Settings to Update

| Setting | Current Suspected Value | Required Value | Priority |
|---------|------------------------|----------------|----------|
| **Authorized JavaScript origins** | `https://hhproduction.vercel.app` | `https://letsmakeai.fun` | **REQUIRED** |
| **Authorized redirect URIs** | `https://hhproduction.vercel.app/api/auth/google/callback` | `https://letsmakeai.fun/api/auth/google/callback` | **REQUIRED** |

### Why It Matters
The `invalid_grant` error in Railway logs ("Google token exchange failed: {error: \"invalid_grant\", error_description: \"Bad Request\"}") is almost certainly caused by a redirect URI mismatch. Google **requires exact string matching** of the `redirect_uri` parameter sent during the OAuth authorization code exchange against the pre-registered URIs in the Cloud Console.

The code now sends `redirect_uri: https://letsmakeai.fun/api/auth/google/callback` (via `GOOGLE_REDIRECT_URI` env var in Railway), but if Google Cloud Console still has the old Vercel URL, the token exchange will fail with `invalid_grant`.

### How Hermes Verified the Need
- Railway environment has `GOOGLE_REDIRECT_URI=https://letsmakeai.fun/api/auth/google/callback` configured
- Railway logs show "Google token exchange failed: invalid_grant" 
- The `api/auth/google/callback.js` and `server.js` both now use `GOOGLE_REDIRECT_URI` from env
- The `api/auth/index.js` also uses the same env var for initiating OAuth
- Old hardcoded Vercel URLs have been replaced in all runtime auth files

---

## 2. RAILWAY ENVIRONMENT VARIABLES

### Platform
Railway Dashboard → Project "Homeworkhelper" → Service "HHproduction" → Variables

### Verify These Are Set Correctly

| Variable | Expected Value | Notes |
|----------|----------------|-------|
| `GOOGLE_REDIRECT_URI` | `https://letsmakeai.fun/api/auth/google/callback` | **Already set** ✅ |
| `FRONTEND_URL` | `https://letsmakeai.fun` | **Already set** ✅ |
| `RAILWAY_PUBLIC_DOMAIN` | `letsmakeai.fun` | **Already set** ✅ |
| `COOKIE_DOMAIN` | `.letsmakeai.fun` | **Already set** ✅ |
| `GOOGLE_CLIENT_ID` | `766794428011-iq8mme64vga0bda0r1l2vr2q700uj6mk.apps.googleusercontent.com` | **Already set** ✅ |
| `GOOGLE_CLIENT_SECRET` | [hidden] | **Already set** ✅ |
| `JWT_SECRET` | [hidden] | **Already set** ✅ |
| `JWT_REFRESH_SECRET` | [hidden] | **Already set** ✅ |
| `DATABASE_URL` | [Neon pooled URL] | **Already set** ✅ |
| `STRIPE_SECRET_KEY` | [hidden] | **Already set** ✅ |
| `STRIPE_WEBHOOK_SECRET` | [hidden] | **Already set** ✅ |
| `STRIPE_PRICE_ID` | `price_1TtFrED2UVcHtOLDoTU4YZ2c` | **Already set** ✅ |
| `RESEND_API_KEY` | [hidden] | **Already set** ✅ |
| `RESEND_WEBHOOK_SECRET` | [hidden] | **Already set** ✅ |
| `SENTRY_DSN` | [hidden] | **Already set** ✅ |
| `VITE_SENTRY_DSN` | [hidden] | **Already set** ✅ |
| `ENCRYPTION_KEY` | [hidden] | **Already set** ✅ |
| `DISCORD_OPS_WEBHOOK` | [hidden] | **Already set** ✅ |
| `ALLOWLIST_EMAIL` | `skyler@letsmakeai.fun` | **Already set** ✅ |

### Action Required
**None — all variables are already configured in Railway.** Just verify they match the expected values above.

---

## 3. STRIPE WEBHOOK ENDPOINT

### Platform
Stripe Dashboard → Developers → Webhooks → [HHproduction webhook endpoint]

### Setting to Update
| Setting | Current Suspected Value | Required Value | Priority |
|---------|------------------------|----------------|----------|
| **Webhook URL** | `https://hhproduction.vercel.app/api/billing/webhook` | `https://letsmakeai.fun/api/billing/webhook` | **REQUIRED** |
| **Events to send** | `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` | Same | — |

### Why It Matters
Stripe webhooks must point to the production domain. If still pointing to Vercel, subscription events won't reach the Railway server.

### How Hermes Verified the Need
- Railway environment has `STRIPE_WEBHOOK_SECRET` configured
- `server.js` handles `/api/billing/webhook` at the same path
- The webhook handler code is now in `server.js` (lines 370-450) and `api/billing/webhook.js`

---

## 4. RESEND WEBHOOK (Inbound Email)

### Platform
Resend Dashboard → Webhooks → [HHproduction webhook]

### Setting to Update
|| Setting | Current Suspected Value | Required Value | Priority ||
||---------|------------------------|----------------|----------||
|| **Webhook URL** | `https://hhproduction.vercel.app/api/webhooks/resend` | `https://letsmakeai.fun/api/webhooks/resend/reply` | **REQUIRED** ||
|| **Events** | `email.received` | Same | — ||

### Why It Matters
Inbound email replies (for the outreach pipeline) won't be processed if the webhook URL is stale.

---

## 5. DNS VERIFICATION

### Platform
Your DNS provider (where `letsmakeai.fun` is managed)

### Verify
| Record | Type | Value | Status |
|--------|------|-------|--------|
| `letsmakeai.fun` | CNAME | `letsmakeai-fun.up.railway.app` (or Railway-provided) | Should already work |
| `www.letsmakeai.fun` | CNAME | `letsmakeai-fun.up.railway.app` | Should already work |

### Why It Matters
Custom domain must resolve to Railway. The `RAILWAY_PUBLIC_DOMAIN=letsmakeai.fun` variable indicates Railway is already configured for this domain.

---

## 6. VERCEL PROJECT (Cleanup - Optional)

### Platform
Vercel Dashboard → Project "hhproduction"

### Recommended Actions
| Action | Priority |
|--------|----------|
| Remove custom domain `letsmakeai.fun` from Vercel project (if still attached) | **RECOMMENDED** |
| Delete or archive the Vercel project to avoid confusion | OPTIONAL |
| Remove Vercel environment variables (secrets cleanup) | **RECOMMENDED** |

### Why It Matters
Prevents accidental deployments to Vercel and avoids confusion about which is production. The Railway deployment is now authoritative.

---

## 7. GITHUB ACTIONS / CI/CD (If Any)

### Platform
GitHub → Repository `ibcnu89/HHproduction` → Settings → Secrets and variables → Actions

### Check For
| Secret | Action |
|--------|--------|
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Remove if no longer needed |
| `RAILWAY_TOKEN` | Ensure it exists for any Railway deployment automation |

---

## SUMMARY: ORDER OF OPERATIONS

1. **FIRST** — Update Google Cloud Console OAuth credentials (Authorized redirect URIs + JavaScript origins) → This unblocks authentication
2. **SECOND** — Update Stripe webhook URL → Ensures billing works
3. **THIRD** — Update Resend webhook URL → Ensures email replies work
4. **FOURTH** — Verify DNS still points to Railway
5. **FIFTH** — Clean up Vercel project (optional but recommended)

---

## VERIFICATION STEPS AFTER MANUAL CHANGES

After you update Google Cloud Console:

1. Open an **incognito/private window** in Chrome
2. Go to `https://letsmakeai.fun`
3. Click "Sign in with Google"
4. Complete the OAuth flow
5. **Expected**: You should land on `https://letsmakeai.fun/apps/homeworkhelper` (or `/`) with the app loaded, **not a white screen**

If you still see a white screen in Chrome after fixing Google Cloud Console:
- Open DevTools (F12) → Console tab
- Look for JavaScript errors
- Check Network tab for failed requests
- Check Application → Cookies for `access_token` and `refresh_token`

---

## FILES MODIFIED BY HERMES (For Reference)

| File | Changes |
|------|---------|
| `api/auth/google/callback.js` | Replaced hardcoded `REDIRECT_URI` and `FRONTEND_URL` with env vars (`GOOGLE_REDIRECT_URI`, `FRONTEND_URL`, `RAILWAY_PUBLIC_DOMAIN`) |
| `api/auth/index.js` | Replaced hardcoded `REDIRECT_URI` with env var (`GOOGLE_REDIRECT_URI`, `FRONTEND_URL`) |
| `api/billing/webhook.js` | Updated comment: Vercel → Railway |
| `HANDOFF.md` | Updated production URL, infrastructure summary, deploy status to Railway |
| `vercel.json` | **Preserved** (deployment config reference, not runtime) |
| `.vercel/` | **Preserved** (deployment artifacts, not runtime) |
| `vercel-api-backup/` | **Preserved** (historical backup of Vercel-era API) |
| `src/main.jsx` | **Preserved** (`@vercel/analytics/react` — still intentionally used for analytics) |

---

**Status:** Code changes complete. Awaiting Google Cloud Console update to unblock Chrome OAuth flow.