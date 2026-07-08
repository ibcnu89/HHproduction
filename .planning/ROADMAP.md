# HHproduction Roadmap — v1.1 Authentication

## Phase 1: Database & Infrastructure Setup

**Goal:** Provision database, create schema, install dependencies, configure environment variables.

**Requirements:** AUTH-01 through AUTH-07 (infrastructure foundation)

**Success criteria:**
- [ ] `DATABASE_URL` placeholder configured in Vercel env vars
- [ ] Database schema SQL file created and reviewed
- [ ] Required npm packages installed (pg, bcryptjs, jsonwebtoken, google-auth-library)
- [ ] Database connection utility created (`api/lib/db.js`)
- [ ] `.env.example` updated with all required variables
- [ ] `npm run build` passes

## Phase 2: Email/Password Authentication

**Goal:** Registration, login, logout, token refresh, and `/api/auth/me` profile endpoint.

**Requirements:** AUTH-01, AUTH-02, AUTH-04, AUTH-05

**Success criteria:**
- [ ] POST /api/auth/register creates user, sets cookies, returns profile
- [ ] POST /api/auth/login verifies credentials, sets cookies, returns profile
- [ ] POST /api/auth/logout clears cookies, invalidates session
- [ ] POST /api/auth/refresh rotates refresh token, issues new access token
- [ ] GET /api/auth/me returns user profile from access token
- [ ] All endpoints return proper error responses (400, 401, 409, 500)

## Phase 3: Google OAuth Integration

**Goal:** Sign in with Google button, account linking for existing email users.

**Requirements:** AUTH-03

**Success criteria:**
- [ ] GET /api/auth/google redirects to Google consent screen
- [ ] GET /api/auth/google/callback exchanges code, creates/links account, sets cookies
- [ ] Google-only user can access app (no password needed)
- [ ] Existing email user can link Google ID

## Phase 4: API Protection Middleware

**Goal:** Apply auth middleware to existing grading endpoints.

**Requirements:** AUTH-06

**Success criteria:**
- [ ] Unauthenticated request to /api/grade → 401
- [ ] Authenticated request to /api/grade → 200 (normal operation)
- [ ] /api/extract, /api/extract-rubric, /api/grade all protected
- [ ] /api/get-standard remains public (standards are not secret)

## Phase 5: Frontend Auth Integration

**Goal:** AuthContext, login/register forms, protected routes, user menu.

**Requirements:** AUTH-07

**Success criteria:**
- [ ] AuthContext provides user state, login(), register(), logout(), refresh()
- [ ] Login form validates email/password, shows errors
- [ ] Register form creates account, redirects to app
- [ ] "Login with Google" button works end-to-end
- [ ] Protected routes redirect to login when unauthenticated
- [ ] User menu shows name/email, logout option
- [ ] Auth state survives page refresh (refresh token rotation from cookie)

## Phase 6: Polish & Optional Features

**Goal:** Password reset, account settings, deployment hardening.

**Optional Requirements:** None (deferred)

**Success criteria:**
- [ ] Password reset flow (request email → token → new password)
- [ ] Account settings page (change password, unlink Google)
- [ ] "Remember me" extends refresh token to 30 days
- [ ] Prod deployment with real Neon DATABASE_URL and Google OAuth creds