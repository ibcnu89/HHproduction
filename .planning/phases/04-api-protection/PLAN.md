# Phase 4 Plan — API Protection Middleware

**Phase:** 4 of 6
**Milestone:** v1.1 — Authentication & Multi-User
**Status:** ✅ Complete
**Date:** 2026-07-10

## Goal

Apply JWT authentication middleware to all grading endpoints so only logged-in users can access the AI-powered homework grading features.

## Requirements Covered

- **AUTH-06:** API endpoints (/api/grade, /api/extract, /api/extract-rubric) require authentication

## Scope

| Endpoint | Action | Rationale |
|----------|--------|-----------|
| `/api/extract` | 🔒 Protected | OCR uses paid Gemini API — must be behind auth |
| `/api/extract-rubric` | 🔒 Protected | Same reasoning — Gemini API cost |
| `/api/grade` | 🔒 Protected | Same reasoning — Gemini API cost |
| `/api/get-standard` | 🔓 Public | Static standards data, no API cost |

## Implementation

### 1. Create `lib/auth.js` — Shared Auth Middleware

Two exports:

- **`requireAuth(req, res)`** — Reads `access_token` cookie, verifies JWT, attaches `req.user`. Returns `user` object or sends 401 and returns `null`.
- **`optionalAuth(req)`** — Same but never errors. Attaches `req.user` if token present/valid, proceeds silently otherwise.

### 2. Apply `requireAuth` to 3 Grading Endpoints

Add at top of each handler (after method check, before body parsing):

```js
import { requireAuth } from '../lib/auth.js';

const user = requireAuth(req, res);
if (!user) return;
```

### 3. Skip `get-standard.js`

Standards data is static JSON — no AI cost, no user-specific content. Remains public.

## Files Changed

| File | Change |
|------|--------|
| `lib/auth.js` | **NEW** — requireAuth + optionalAuth middleware |
| `api/extract.js` | Added requireAuth guard (2 lines) |
| `api/extract-rubric.js` | Added requireAuth guard (2 lines) |
| `api/grade.js` | Added requireAuth guard (2 lines) |

## Files NOT Changed

| File | Reason |
|------|--------|
| `api/get-standard.js` | Static standards data — intentionally public |
| `api/auth/*` | Auth endpoints themselves must be public |
| All frontend files | Phase 5 handles UI integration |

## Verification

- [x] `npm run build` passes (vite build completes, no errors)
- [x] All 3 grading endpoints import and call `requireAuth`
- [x] `get-standard.js` has zero auth references
- [x] 401 response format: `{ error: "Authentication required..." }` or `{ error: "Session expired..." }`
- [ ] POST `/api/grade` without cookie → 401 (verify via curl after deploy)
- [ ] POST `/api/grade` with valid access_token cookie → 200 (verify via curl after deploy)

## Deploy

- Vercel auto-deploys on push to `main`
- No new env vars needed — middleware reuses existing `access_token` cookie + `JWT_SECRET`
- Existing users will see 401 until frontend auth UI is added (Phase 5)