# HHproduction — HomeworkHelper AI

**Started:** 2026-07-07
**Last updated:** 2026-07-08

## What This Is

An AI homework grading tool for teachers. Upload handwritten student work → OCR extraction → AI grades against Illinois Learning Standards (IBSE) or custom rubrics. Deployed on Vercel, uses Gemini 2.5 Flash for vision + grading, IndexedDB for client-side rubric storage.

## Core Value

Save teachers hours of grading time by providing instant, standards-aligned feedback on handwritten homework. Teachers can override auto-generated rubrics with their own answer keys.

## Current Milestone: v1.1 Authentication & Multi-User

**Goal:** Add user accounts so teachers can save history, reuse rubrics across sessions, and protect API endpoints.

**Target features:**
- Email/password registration and login
- Google OAuth sign-in
- JWT-based session management with refresh token rotation
- Protected API endpoints (grade, extract, extract-rubric)
- Persistent user data via PostgreSQL (Neon)

## Key Decisions

| Decision | Rationale | When |
|----------|-----------|------|
| Gemini 2.5 Flash for AI | Free tier, fast, good OCR | 2026-07-07 |
| Vercel serverless API functions | Zero-config deploys, cold-start OK for async grading | 2026-07-07 |
| IBSE standards as baseline | Illinois teachers are primary audience | 2026-07-07 |
| Neon PostgreSQL | Generous free tier, serverless-friendly, PostgreSQL | 2026-07-08 |
| Custom JWT + bcrypt (not Auth0/Clerk) | Full control, no vendor costs, learning value | 2026-07-08 |
| HTTP-only Secure cookies for tokens | XSS-resistant, SameSite for CSRF | 2026-07-08 |

## Active Requirements

### v1.0 — Core Grading (COMPLETED)
- [x] HW-01: Teacher uploads homework image → extract handwriting via OCR
- [x] HW-02: Auto-grade against Illinois Learning Standards
- [x] HW-03: Teacher provides custom rubric/answer key
- [x] HW-04: Grade levels K–12 with strictness guidance
- [x] HW-05: Save custom rubrics to IndexedDB
- [x] HW-06: Subject carryover (remembers last-used subject)
- [x] HW-07: Dark mode support

### v1.1 — Authentication (CURRENT)
- [ ] AUTH-01: User can register with email/password
- [ ] AUTH-02: User can login with email/password
- [ ] AUTH-03: User can login with Google OAuth
- [ ] AUTH-04: Session persists across page refreshes (refresh token rotation)
- [ ] AUTH-05: User can logout
- [ ] AUTH-06: API endpoints (/api/grade, /api/extract, /api/extract-rubric) require auth
- [ ] AUTH-07: Auth state reflected in UI (login/register forms, user menu)

## Context

- **Codebase:** Vite + React 19 frontend, Vercel serverless API functions (Node.js)
- **AI:** Gemini 2.5 Flash via REST API
- **Deployment:** Vercel (project: hhproduction, org: team_SAg71JDSgZpnjpQ6FFYO3K3E)
- **Current state:** Core grading works end-to-end. No auth. All API keys client-visible (fixed server-side).
- **Database:** Neon PostgreSQL (provisioning in Phase 1)

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state