# Phase 6 Plan — Polish & Optional Features

**Phase:** 6 of 6
**Milestone:** v1.1 — Authentication & Multi-User
**Status:** ✅ Complete
**Date:** 2026-07-10

## Goal

Complete the authentication & multi-user milestone with password reset, account settings, "remember me", and final deployment hardening.

## Requirements Covered

- **AUTH-06:** (Phase 4) API endpoints (/api/grade, /api/extract, /api/extract-rubric) require auth
- **AUTH-07:** (Phase 5) Auth state reflected in UI (login/register forms, user menu)
- **New:** Password reset flow (forgot + reset)
- **New:** Account settings page (change password, unlink Google)
- **New:** "Remember me" checkbox on login

## Implementation Details

### Backend Endpoints Added

| Endpoint | Method | Auth Required | Purpose |
|----------|--------|---------------|---------|
| `/api/auth/forgot-password` | POST | ❌ | Generate reset token (returns token directly, no email yet) |
| `/api/auth/reset-password` | POST | ❌ | Accept token + new password, update hash |
| `/api/auth/change-password` | POST | ✅ | Change password while logged in (current + new) |
| `/api/auth/unlink-google` | POST | ✅ | Remove Google OAuth link (requires password) |

### Frontend Components Added/Modified

| File | Change |
|------|--------|
| `src/components/AuthPage.jsx` | **Rewritten** — 4 modes: login, register, forgot, reset. Added "remember me" checkbox. |
| `src/components/AccountSettings.jsx` | **NEW** — Slide-out panel with change password, unlink Google, profile display |
| `src/components/Header.jsx` | Added "Account Settings" link in user dropdown menu |
| `src/contexts/AuthContext.jsx` | `login()` now accepts `rememberMe` parameter |
| `src/App.jsx` | Wire `isAccountSettingsOpen` state, pass handler to Header, render AccountSettings |

### Key Flows

1. **Forgot Password** → User enters email → API returns reset token → Auto-switches to Reset mode → User pastes token + new password → Success → Auto-redirect to login
2. **Change Password** → User opens Account Settings → enters current + new password → API validates current → updates hash
3. **Unlink Google** → User clicks "Unlink Google" → API verifies user has password → clears `google_id` column
4. **Remember Me** → Checkbox on login → sent to `/api/auth/login` → backend creates 30d refresh token instead of 7d

## Files Changed

### New
- `src/components/AccountSettings.jsx` (242 lines)
- `api/auth/forgot-password.js`
- `api/auth/reset-password.js`
- `api/auth/change-password.js`
- `api/auth/unlink-google.js`

### Modified
- `src/components/AuthPage.jsx` (complete rewrite: 209 → 400+ lines)
- `src/components/Header.jsx` (added Account Settings dropdown item)
- `src/components/App.jsx` (added account settings state + render)
- `src/contexts/AuthContext.jsx` (login accepts rememberMe)
- `src/lib/gradeHomework.js` (unchanged from Phase 5)
- `.planning/STATE.md` (updated)

## Verification

- [x] `npm run build` passes (25 modules, 213ms)
- [x] All 4 new backend endpoints lint clean
- [x] AuthPage handles login/register/forgot/reset modes with validation
- [x] AccountSettings panel renders with change password + unlink Google
- [x] Header dropdown includes "Account Settings" link
- [x] Remember me checkbox on login form
- [x] 401 auto-refresh still works (gradeHomework.js authFetch)

## Deploy

- Vercel auto-deploys on push to main
- No new env vars needed
- All auth endpoints already live on production

## Next: Phase 7 — Stripe Subscription System (to be planned)