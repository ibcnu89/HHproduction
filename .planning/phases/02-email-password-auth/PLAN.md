# Phase 2 Plan: Email/Password Authentication

## Goal
Implement email/password registration, login, logout, token refresh, and profile endpoint. All JWT tokens in HTTP-only Secure cookies.

## Requirements Covered
- **AUTH-01**: User can register with email/password
- **AUTH-02**: User can login with email/password
- **AUTH-04**: Session persists across page refreshes (refresh token rotation)
- **AUTH-05**: User can logout (session invalidated)

## Architecture

```
Request → Vercel Serverless → Neon PostgreSQL
                                    ↓
                          users table (bcrypt hash)
                          sessions table (SHA-256 refresh token)
                                    ↓
                          JWT cookies ← Set-Cookie header
```

- Access token: 15 min, JWT in `access_token` cookie (SameSite=Lax)
- Refresh token: 7 days (30 with remember_me), JWT in `refresh_token` cookie (SameSite=Strict)
- Refresh rotation: old session deleted, new one created → prevents replay attacks

## Tasks

### Task 1: Auth utility modules ✅
**Files:** `api/lib/password.js`, `api/lib/jwt.js`, `api/lib/cookies.js`
- `password.js`: bcryptjs hash/verify, password strength validation, SHA-256 helper
- `jwt.js`: createAccessToken, createRefreshToken, verifyAccessToken, verifyRefreshToken
- `cookies.js`: setAccessTokenCookie, setRefreshTokenCookie, clearAuthCookies, getCookie

### Task 2: POST /api/auth/register ✅
**File:** `api/auth/register.js`
- Validates email format + password strength
- Checks for existing email (409 conflict)
- Hashes password with bcrypt (cost 12)
- Creates user in PostgreSQL
- Creates session row
- Issues JWT access + refresh tokens
- Sets HTTP-only Secure cookies
- Returns user profile (201)

### Task 3: POST /api/auth/login ✅
**File:** `api/auth/login.js`
- Finds user by email
- Handles Google-only accounts (no password_hash → 401 with redirect message)
- Verifies password with bcrypt
- Creates session, issues tokens, sets cookies
- Supports `remember_me` (30-day refresh token)
- Returns user profile (200)

### Task 4: POST /api/auth/logout ✅
**File:** `api/auth/logout.js`
- Clears cookies regardless of token validity
- If refresh token present + valid, deletes session from DB
- Always returns 200 (idempotent — logged out is logged out)

### Task 5: POST /api/auth/refresh ✅
**File:** `api/auth/refresh.js`
- Reads refresh_token cookie
- Verifies JWT signature + expiry
- Validates session exists + token hash matches (replay detection)
- Deletes old session, creates new one (rotation)
- Issues new access + refresh tokens with new cookies
- On mismatch: deletes ALL user sessions (defensive), clears cookies, returns 401

### Task 6: GET /api/auth/me ✅
**File:** `api/auth/me.js`
- Reads access_token cookie
- Verifies JWT
- Returns user profile or 401 with TOKEN_EXPIRED code

### Task 7: Build verification ✅
- `npm run build` passes

## Deliverables
- [x] `api/lib/password.js` — bcrypt hashing + validation
- [x] `api/lib/jwt.js` — token creation/verification
- [x] `api/lib/cookies.js` — cookie helpers
- [x] `api/auth/register.js` — account creation
- [x] `api/auth/login.js` — credential verification
- [x] `api/auth/logout.js` — session invalidation
- [x] `api/auth/refresh.js` — token rotation with replay protection
- [x] `api/auth/me.js` — profile lookup

## ⚠️ Deploy Blocked
Vercel CLI token expired. Requires `vercel login` (browser OAuth). Code is complete and build-verified — just needs re-auth to push to prod.

## How to Verify (After Deploy)

```bash
# Register
curl -X POST https://hhproduction.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123","name":"Test User"}' \
  -c cookies.txt -v

# Login
curl -X POST https://hhproduction.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}' \
  -c cookies.txt -v

# Get profile
curl https://hhproduction.vercel.app/api/auth/me -b cookies.txt

# Refresh
curl -X POST https://hhproduction.vercel.app/api/auth/refresh -b cookies.txt -c cookies.txt

# Logout
curl -X POST https://hhproduction.vercel.app/api/auth/logout -b cookies.txt -c cookies.txt
```

## Ready for Phase 3
Google OAuth integration once Vercel deploy is back online.