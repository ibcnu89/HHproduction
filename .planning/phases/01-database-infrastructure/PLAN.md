# Phase 1 Plan: Database & Infrastructure Setup

## Goal
Provision PostgreSQL database, create schema, install dependencies, configure environment variables — the foundation for all auth work in Phases 2–5.

## Requirements Covered
AUTH-01 through AUTH-07 — infrastructure foundation (no user-facing auth yet)

## Tasks

### Task 1: Install npm dependencies ✅
**Commands:** `npm install pg bcryptjs jsonwebtoken google-auth-library cookie`
**Verification:** `npm ls pg bcryptjs jsonwebtoken` shows installed versions

### Task 2: Create database schema ✅
**File:** `api/schema.sql`
**Verification:** SQL is valid PostgreSQL, uses IF NOT EXISTS for idempotency
**Contents:**
- `users` table: id, email, password_hash, google_id, name, avatar_url, email_verified, timestamps
- `sessions` table: id, user_id, refresh_token_hash, user_agent, ip_hash, expires_at
- Indexes on sessions.user_id and sessions.expires_at
- Trigger for auto-updating users.updated_at

### Task 3: Create database connection utility ✅
**File:** `api/lib/db.js`
**Verification:** Exports getPool(), query(), getClient(), runMigrations()
**Details:**
- pg Pool with Neon-compatible SSL config
- Lazy initialization (doesn't connect until first query)
- Pool limits: max 5 connections, 30s idle timeout, 5s connection timeout
- Error handler logs but doesn't crash

### Task 4: Update .env.example ✅
**File:** `.env.example`
**Verification:** Contains all 6 auth variables with placeholder values and docs
**Variables:** GEMINI_API_KEY, DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, COOKIE_DOMAIN

### Task 5: Add Vercel environment variables ✅
**Commands:** `vercel env add` for JWT_SECRET, JWT_REFRESH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, COOKIE_DOMAIN
**Note:** DATABASE_URL already existed. All use placeholder values until real secrets are generated.
**Verification:** `vercel env ls` lists all 7 variables

### Task 6: Verify build ✅
**Command:** `npm run build`
**Expected:** Clean exit with dist/ output

## Deliverables
- [x] `package.json` — updated with 5 new dependencies
- [x] `api/schema.sql` — users + sessions tables
- [x] `api/lib/db.js` — pg Pool connection utility
- [x] `.env.example` — all auth variables documented
- [x] Vercel env vars — 6 new production variables with placeholders

## How to Verify End-to-End (After DB Provisioned)
1. Get real `DATABASE_URL` from Neon console
2. Update Vercel env var: `vercel env rm DATABASE_URL production` then `vercel env add DATABASE_URL production`
3. Run migration: add a `/api/migrate` endpoint or run `psql $DATABASE_URL -f api/schema.sql` locally
4. Verify: `psql $DATABASE_URL -c "\dt"` shows users and sessions tables

## Ready for Phase 2
Once Neon DATABASE_URL is real (not placeholder), we can implement `/api/auth/register` and `/api/auth/login`.