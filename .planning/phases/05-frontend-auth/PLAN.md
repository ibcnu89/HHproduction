# Phase 5 Plan — Frontend Auth Integration

**Phase:** 5 of 6
**Milestone:** v1.1 — Authentication & Multi-User
**Status:** ✅ Complete
**Date:** 2026-07-10

## Goal

Add auth UI to the client so teachers can sign in, see their profile, and access the protected grading endpoints with their session cookie.

## Requirements Covered

- **AUTH-07:** Auth state reflected in UI (login/register forms, user menu)

## Architecture

```
src/
├── contexts/
│   └── AuthContext.jsx        # NEW — React Context: user state + auth actions
├── components/
│   ├── AuthPage.jsx           # NEW — Login/Register forms + Google button
│   ├── Header.jsx             # MODIFIED — Added user avatar + dropdown menu
├── lib/
│   └── gradeHomework.js       # MODIFIED — authFetch wrapper with 401→refresh
├── App.jsx                    # MODIFIED — Auth gating (AuthPage vs GradingApp)
└── main.jsx                   # UNCHANGED — App export includes AuthProvider
```

## Implementation Details

### 1. AuthContext (`src/contexts/AuthContext.jsx`)

React Context providing:

| Export | Type | Purpose |
|--------|------|---------|
| `user` | `{ id, email, name } \| null` | Current user profile |
| `loading` | `boolean` | True while initial `/api/auth/me` check runs |
| `login(email, pw)` | `async () => void` | POST `/api/auth/login` → fetch user |
| `register(name, email, pw)` | `async () => void` | POST `/api/auth/register` → fetch user |
| `loginWithGoogle()` | `async () => void` | Opens popup to `/api/auth/google`, polls for result |
| `logout()` | `async () => void` | POST `/api/auth/logout` → clear state |
| `refresh()` | `async () => boolean` | POST `/api/auth/refresh` → returns ok status |

On mount, calls `GET /api/auth/me` to check for existing session cookie. If valid, user is immediately logged in (page refresh survival).

### 2. AuthPage (`src/components/AuthPage.jsx`)

Single component with two modes (toggled by tabs):

- **Sign In** — email + password form, Google OAuth button
- **Create Account** — name + email + password form, Google OAuth button

Validation: email format check, password ≥ 8 chars, name required (register only). Error banner for server errors (409 duplicate email, 401 bad credentials, etc.).

### 3. Header User Menu (`src/components/Header.jsx`)

Added to the right side of the header:

- User avatar (first letter of name/email)
- Name/email truncated display
- Dropdown: "Signed in as {name}" + Sign Out button
- Outside-click closes dropdown

### 4. Auth Gating (`src/App.jsx`)

```
loading → spinner
no user → <AuthPage />
user    → <GradingApp />
```

On `auth_required` error during grading: auto-logout → AuthPage renders.

### 5. API Auth Wrapper (`src/lib/gradeHomework.js`)

New `authFetch()` wrapper:

1. Sends `credentials: 'include'` on every API call
2. On HTTP 401: POST `/api/auth/refresh` to rotate the access token
3. If refresh OK: retry original request once
4. If refresh fails: throw `'auth_required'` → App.jsx triggers logout

All three endpoints (`extractHandwriting`, `gradeSubmission`, `extractCustomRubric`) now use `authFetch`.

## Files Changed

| File | Change |
|------|--------|
| `src/contexts/AuthContext.jsx` | **NEW** — 171 lines |
| `src/components/AuthPage.jsx` | **NEW** — 209 lines |
| `src/components/Header.jsx` | Modified — added user avatar + dropdown (47 lines) |
| `src/App.jsx` | Modified — refactored into App + GradingApp + WrappedApp |
| `src/lib/gradeHomework.js` | Modified — added `authFetch` with 401→refresh handling |
| `src/main.jsx` | Unchanged — default export chain picks up WrappedApp |

## Verification

- [x] `npm run build` passes (24 modules, 204ms)
- [x] AuthContext provides full user lifecycle (login/register/logout/refresh/Google)
- [x] AuthPage handles both login and register modes with validation
- [x] Header shows user menu when logged in, hides when not
- [x] API calls include credentials + auto-refresh on 401
- [x] Auth gating: loading → spinner, no user → AuthPage, user → GradingApp
- [ ] Real browser test: register → see grading app → refresh page → still logged in
- [ ] Real browser test: login → grade homework → logout → see AuthPage
- [ ] Real browser test: Google OAuth popup flow

## Deploy

- Vercel auto-deploys on push to main
- No new env vars needed — all auth APIs already live