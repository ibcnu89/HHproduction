# HHproduction Requirements — v1.1 Authentication

## Active Requirements (v1.1)

### Authentication
- [ ] **AUTH-01**: User can register with email and password
- [ ] **AUTH-02**: User can login with email and password
- [ ] **AUTH-03**: User can login with Google OAuth
- [ ] **AUTH-04**: Session persists across page refreshes via refresh token rotation
- [ ] **AUTH-05**: User can logout (session invalidated, cookies cleared)
- [ ] **AUTH-06**: Grading API endpoints (/api/grade, /api/extract, /api/extract-rubric) require authentication
- [ ] **AUTH-07**: Auth state reflected in UI (login/register forms, user menu, protected routes)

## Validated Requirements (v1.0)

- [x] **HW-01**: Teacher uploads homework image → OCR extraction (Phase v1.0)
- [x] **HW-02**: Auto-grade against Illinois Learning Standards (Phase v1.0)
- [x] **HW-03**: Teacher provides custom rubric/answer key (Phase v1.0)
- [x] **HW-04**: Grade levels K–12 with strictness guidance (Phase v1.0)
- [x] **HW-05**: Save custom rubrics to IndexedDB (Phase v1.0)
- [x] **HW-06**: Subject carryover (remembers last-used subject) (Phase v1.0)
- [x] **HW-07**: Dark mode support (Phase v1.0)

## Future Requirements (Deferred)

None yet.

## Out of Scope

None yet.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| AUTH-01 | 2 | Not started |
| AUTH-02 | 2 | Not started |
| AUTH-03 | 3 | Not started |
| AUTH-04 | 2 | Not started |
| AUTH-05 | 2 | Not started |
| AUTH-06 | 4 | Not started |
| AUTH-07 | 5 | Not started |
| HW-01 through HW-07 | v1.0 | Validated |