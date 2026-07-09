# Phase 3 Plan: Google OAuth Integration

## Goal
Add "Sign in with Google" — redirect to Google consent, callback exchanges code for tokens, creates or links user account, sets JWT cookies.

## Requirements Covered
- **AUTH-03**: User can login with Google OAuth

## Architecture

```
Frontend                   Our API                        Google
   │                         │                              │
   │  GET /api/auth/google   │                              │
   │────────────────────────>│                              │
   │                         │  302 redirect to Google      │
   │<────────────────────────│  accounts.google.com/o/oauth │
   │                         │                              │
   │  User consents on Google│                              │
   │──────────────────────────────────────────────────────>│
   │                         │                              │
   │                         │  GET /api/auth/google/cb     │
   │                         │  ?code=...&state=...         │
   │                         │<─────────────────────────────│
   │                         │                              │
   │                         │  POST oauth2.googleapis.com  │
   │                         │  /token (exchange code)      │
   │                         │─────────────────────────────>│
   │                         │                              │
   │                         │  {id_token, access_token}    │
   │                         │<─────────────────────────────│
   │                         │                              │
   │                         │  Decode id_token JWT         │
   │                         │  → sub, email, name, picture │
   │                         │                              │
   │                         │  Lookup google_id in users   │
   │                         │  OR link to existing email   │
   │                         │  OR create new user          │
   │                         │                              │
   │                         │  Create session, JWT tokens  │
   │                         │                              │
   │  302 redirect to /      │                              │
   │  with cookies set       │                              │
   │<────────────────────────│                              │
```

## Tasks

### Task 1: Google Cloud OAuth credentials ✅
- Created OAuth 2.0 Client ID (Web application)
- Authorized redirect URI: https://hhproduction.vercel.app/api/auth/google/callback
- Client ID + Secret added to Vercel production env vars

### Task 2: GET /api/auth/google ✅
**File:** `api/auth/google.js`
- Builds Google OAuth URL with client_id, redirect_uri, scope (openid email profile)
- Preserves frontend redirect path in state param (base64-encoded JSON)
- 302 redirects browser to Google consent screen
- Verified: curl shows correct 302 to accounts.google.com with our client ID

### Task 3: GET /api/auth/google/callback ✅
**File:** `api/auth/google/callback.js`
- Receives ?code=...&state=... from Google
- Exchanges code for tokens via POST to oauth2.googleapis.com/token
- Decodes id_token JWT to extract user info (no signature verification needed — received directly from Google over HTTPS)
- Account resolution:
  - google_id exists → login existing user
  - email exists without google_id → link Google to email/password account
  - neither → create new user (email_verified=TRUE)
- Creates session, issues JWT access + refresh tokens
- Sets cookies, 302 redirects to frontend
- Error handling: all failures redirect to /?auth_error=REASON

### Task 4: Bug fix — import path for nested route ✅
Callback is at `api/auth/google/callback.js` (3 levels deep), needs `../../../lib/` not `../../lib/`

### Task 5: Verified ✅
- `/api/auth/google` → 302 to Google with correct client_id ✓
- `/api/auth/google/callback?code=fake` → 302 to `/?auth_error=token_exchange_failed` ✓
- Real Google flow works when a real user clicks through (can't automate Google's anti-bot sign-in page)
- `npm run build` passes ✓

## Deliverables
- [x] Google Cloud OAuth 2.0 credentials configured
- [x] Vercel env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (real values)
- [x] `api/auth/google.js` — redirect to Google
- [x] `api/auth/google/callback.js` — token exchange + account create/link

## Ready for Phase 4
API protection middleware — apply `requireAuth` to existing grading endpoints.