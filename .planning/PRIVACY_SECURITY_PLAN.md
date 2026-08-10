# HHproduction Privacy & Security Implementation Plan

**Created:** 2026-08-09  
**Status:** Ready for Implementation  
**Scope:** Teacher-only app (students never log in) — COPPA parental consent NOT required

---

## Executive Summary

This plan addresses all identified privacy/security gaps in HHproduction. The app is teacher-only — students never create accounts or log in. Teachers upload student work for grading. COPPA parental consent is explicitly out of scope.

---

## Phase 1: Data Deletion & Account Removal (Week 1)

### 1.1 Delete Account Endpoint
**File:** `server.js` (new route)  
**Endpoint:** `DELETE /api/user/account`

```javascript
// Requires: authenticated user, password confirmation
app.delete('/api/user/account', requireAuth, async (req, res) => {
  const { password } = req.body;
  // 1. Verify password
  // 2. Begin transaction
  // 3. Cascade delete: sessions, batch_grading_sessions, user_preferences, 
  //    user_custom_subjects, classroom_sync_logs, students (new table)
  // 4. Delete user record
  // 5. Clear auth cookies
  // 6. Return 204
});
```

**Acceptance Criteria:**
- [ ] Returns 401 if unauthenticated
- [ ] Returns 400 if password missing/incorrect
- [ ] Cascades to ALL related tables (see schema.sql foreign keys)
- [ ] Clears access_token & refresh_token cookies
- [ ] Returns 204 on success
- [ ] Logged in audit table

### 1.2 Frontend Account Deletion UI
**File:** `src/components/AccountSettings.jsx`  
**Changes:** Add "Danger Zone" section with delete account button, password confirmation modal

**Acceptance Criteria:**
- [ ] Delete button only visible in Danger Zone
- [ ] Requires password confirmation
- [ ] Shows irreversible warning
- [ ] Redirects to login on success

---

## Phase 2: Retention Policies & Cron Jobs (Week 1-2)

### 2.1 Database Schema Additions
**File:** `migrations/008_retention_policies.sql` (new)

```sql
-- Retention configuration (configurable per deployment)
CREATE TABLE IF NOT EXISTS retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type VARCHAR(50) NOT NULL UNIQUE, -- 'grading_images', 'batch_results', 'classroom_sync_logs', 'audit_logs'
  retention_days INT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert defaults
INSERT INTO retention_policies (resource_type, retention_days, description) VALUES
  ('grading_images', 30, 'Uploaded homework images purged after grading'),
  ('batch_results', 365, 'Batch grading results retained for 1 year'),
  ('classroom_sync_logs', 90, 'Classroom sync audit trail'),
  ('audit_logs', 365, 'Security audit log retention'),
  ('grading_results', 730, 'Individual grading results retained 2 years')
ON CONFLICT (resource_type) DO NOTHING;

-- Add deleted_at for soft delete tracking
ALTER TABLE batch_grading_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
```

### 2.2 Retention Cron Job
**File:** `scripts/ops/retention-cleanup.js` (new)

```javascript
// Runs daily via cron
// For each retention_policy:
//   - Find records older than retention_days
//   - Soft delete (set deleted_at) or hard delete based on policy
//   - Log to audit_logs
```

**Acceptance Criteria:**
- [ ] Runs daily at 2 AM UTC
- [ ] Configurable via retention_policies table
- [ ] Logs each cleanup action to audit_logs
- [ ] Doesn't delete data referenced by active user sessions
- [ ] Handles partial failures gracefully

### 2.3 Image Purging After Grading
**File:** `api/grade.js` (modify) & `api/extract.js` (modify)

```javascript
// After successful grading:
// 1. If image was only for this grading (not saved to batch), delete immediately
// 2. If part of batch, schedule deletion after batch completion
// 3. Use multer's in-memory storage (already configured) — no disk writes needed
```

**Acceptance Criteria:**
- [ ] No images written to disk (multer memoryStorage already in use)
- [ ] Images GC'd after request completes
- [ ] Batch images purged after batch completion

---

## Phase 3: Student Data Segregation (Week 2)

### 3.1 New Students Table
**File:** `migrations/009_students.sql` (new)

```sql
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Google Classroom sync fields (only populated if synced)
  classroom_student_id VARCHAR(255), -- Google's internal ID
  classroom_course_id VARCHAR(255),
  name VARCHAR(255), -- Full name from Classroom
  email VARCHAR(255), -- Email from Classroom (optional)
  -- Local grading reference (if teacher adds manually)
  local_identifier VARCHAR(100), -- e.g., "Period 3, Seat 5"
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, -- Soft delete
  UNIQUE (teacher_id, classroom_student_id, classroom_course_id)
);

CREATE INDEX IF NOT EXISTS idx_students_teacher ON students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_classroom ON students(classroom_student_id, classroom_course_id);
CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Link grading results to students
ALTER TABLE batch_grading_sessions 
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE SET NULL;

-- Create student_grading_results for individual question tracking
CREATE TABLE IF NOT EXISTS student_grading_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  batch_session_id UUID NOT NULL REFERENCES batch_grading_sessions(id) ON DELETE CASCADE,
  question_number INT NOT NULL,
  question_text TEXT,
  student_answer TEXT,
  is_correct BOOLEAN,
  points_earned DECIMAL(5,2),
  points_possible DECIMAL(5,2),
  feedback TEXT,
  graded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_results_student ON student_grading_results(student_id);
CREATE INDEX IF NOT EXISTS idx_student_results_batch ON student_grading_results(batch_session_id);
```

### 3.2 Update Classroom Sync
**Files:** `lib/classroom-sync.js`, `lib/classroom-grades.js`

**Changes:**
- Store student records in `students` table (not in JSONB)
- Link grading results via `student_id` foreign key
- PII fields: `name`, `email` — only populated from Classroom API

**Acceptance Criteria:**
- [ ] Students table created with proper FK to users
- [ ] Classroom sync upserts student records
- [ ] Grading results reference student_id
- [ ] Soft delete supported for student records

---

## Phase 4: Privacy Policy & Terms Pages (Week 2)

### 4.1 Backend Routes
**File:** `server.js` (new routes)

```javascript
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'privacy.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'terms.html')));
```

### 4.2 Frontend Pages
**Files:** `src/pages/PrivacyPage.jsx` (new), `src/pages/TermsPage.jsx` (new)

**Content Requirements (Privacy Policy):**
- Data collected: teacher email, password hash, Google OAuth tokens, uploaded images, grading results
- Student data: only what teacher uploads or syncs from Classroom (name, email from Classroom)
- Purpose: grading, batch processing, Classroom sync
- Retention: per retention_policies table
- Rights: deletion via account settings, data export
- No sale of data, no advertising
- FERPA: we act as school official under 34 CFR §99.31
- Contact: privacy@letsmakeai.fun

**Content Requirements (Terms of Service):**
- Teacher must be 18+
- No student accounts allowed
- Subscription terms, trial, cancellation
- Acceptable use (no illegal content, no scraping)
- Liability limits
- Governing law: Illinois

### 4.3 Routing
**File:** `src/App.jsx` — add `/privacy` and `/terms` routes

**Acceptance Criteria:**
- [ ] `/privacy` and `/terms` accessible without auth
- [ ] Links in footer, AccountSettings, SubscriptionGate work
- [ ] Content accurate and complete
- [ ] Last updated date shown

---

## Phase 5: DPA Template (Week 3)

### 5.1 DPA Document
**File:** `docs/DPA_TEMPLATE.md` (new)

**Sections:**
1. Parties & Definitions
2. Scope & Duration
3. Data Categories (teacher PII, student PII from Classroom)
4. Processor Obligations (security, sub-processors, breach notification)
5. Data Subject Rights (deletion, access, portability)
6. International Transfers (US hosting, SCCs if EU)
7. Audit Rights
8. Termination & Data Return/Deletion
9. Liability & Indemnification

### 5.2 DPA Generator
**File:** `scripts/ops/generate-dpa.js` (new)

```javascript
// Generates filled DPA for a specific district
// Inputs: district name, contact, signed date
// Output: PDF/HTML ready for signature
```

**Acceptance Criteria:**
- [ ] Template covers FERPA requirements
- [ ] Generator produces district-specific DPA
- [ ] PDF output for signing
- [ ] Stored in `content/legal/dpa/`

---

## Phase 6: Audit Logging (Week 3)

### 6.1 Audit Log Table
**File:** `migrations/010_audit_logs.sql` (new)

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- 'login', 'logout', 'grade', 'batch_grade', 'delete_account', 'sync_classroom', 'export_data', 'delete_data'
  resource_type VARCHAR(50), -- 'user', 'batch_session', 'student', 'grading_result'
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);

-- Partition by month for performance (optional, for scale)
```

### 6.2 Audit Middleware
**File:** `lib/audit.js` (new)

```javascript
export async function auditLog({ userId, action, resourceType, resourceId, req, metadata = {} }) {
  const client = await getClient();
  try {
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, resourceType, resourceId, req.ip, req.get('user-agent'), metadata]
    );
  } catch (err) {
    console.error('Audit log failed:', err); // Never block request
  }
}

// Decorator for route handlers
export function withAudit(action, resourceType) {
  return (handler) => async (req, res) => {
    try {
      const result = await handler(req, res);
      await auditLog({
        userId: req.user?.id,
        action,
        resourceType,
        resourceId: req.params.id,
        req,
        metadata: { status: res.statusCode }
      });
      return result;
    } catch (err) {
      await auditLog({
        userId: req.user?.id,
        action: `${action}_failed`,
        resourceType,
        resourceId: req.params.id,
        req,
        metadata: { error: err.message }
      });
      throw err;
    }
  };
}
```

### 6.3 Instrument Key Routes
**Files:** `server.js` — wrap existing handlers

```javascript
// Apply withAudit to:
// - POST /api/auth/login, /register, /logout
// - POST /api/grade, /api/batch-grade
// - DELETE /api/user/account
// - POST /api/classroom/sync, /api/classroom/grades
// - POST /api/billing/checkout
```

**Acceptance Criteria:**
- [ ] All sensitive actions logged
- [ ] Never blocks request on failure
- [ ] Includes IP, user agent, user ID
- [ ] Queryable by user, action, date range
- [ ] Retention per retention_policies (365 days default)

---

## Phase 7: Classroom Sync PII Handling (Week 3)

### 7.1 Audit Current Sync
**Files:** `lib/classroom-sync.js`, `lib/classroom-grades.js`

**Current PII stored:**
- `studentName` (full name)
- `studentEmail` (email address)
- Google internal IDs

**Required Changes:**
```javascript
// In classroom-sync.js:
// 1. Upsert into students table (not just in-memory)
// 2. Only store: classroom_student_id, classroom_course_id, name, email
// 3. Add deleted_at for students no longer in course
// 4. Log sync actions to audit_logs

// In classroom-grades.js:
// 1. Link push to student_id FK
// 2. Don't duplicate PII in grade records
```

**Acceptance Criteria:**
- [ ] Student PII only in `students` table
- [ ] Sync creates/updates student records
- [ ] Soft delete students removed from Classroom
- [ ] Audit log entry per sync

---

## Phase 8: Image Purging Verification (Week 2)

### 8.1 Verify Multer Config
**File:** `server.js` — confirm memoryStorage

```javascript
// Current (should already be):
const upload = multer({ storage: multer.memoryStorage() });
```

**Acceptance Criteria:**
- [ ] No disk writes for uploads
- [ ] Images only in memory during request
- [ ] GC cleans up after response

---

## Implementation Order & Dependencies

```
Week 1:
  ├── Phase 1 (Data Deletion) ──┐
  └── Phase 2.1-2.2 (Retention) ├── Can run in parallel

Week 2:
  ├── Phase 2.3 (Image Purge)
  ├── Phase 3 (Students Table)
  ├── Phase 4 (Privacy/Terms)
  └── Phase 8 (Image Verify)

Week 3:
  ├── Phase 5 (DPA Template)
  ├── Phase 6 (Audit Logging)
  └── Phase 7 (Classroom PII)
```

---

## Testing Checklist

| Test | Phase | Method |
|------|-------|--------|
| Delete account cascades correctly | 1 | Integration test with seeded DB |
| Retention cron deletes old data | 2 | Unit test with time mocking |
| Images not written to disk | 2, 8 | Check /tmp after upload |
| Student FK works for grading | 3 | Batch grade → check student_grading_results |
| Privacy/Terms accessible | 4 | E2E test without auth |
| DPA generates valid PDF | 5 | Script output inspection |
| Audit logs all key actions | 6 | Query audit_logs after each action |
| Classroom sync doesn't leak PII | 7 | Sync → check students table only |
| Account deletion removes all data | 1 | Delete → verify cascade |

---

## Rollback Plan

Each migration is idempotent (`IF NOT EXISTS`). To rollback:
1. Deploy previous server.js version
2. Run reverse migrations (drop tables in reverse order)
3. Clear retention_policies and audit_logs if needed

---

## Monitoring & Alerts

- **Cron job failures:** Discord alert (existing `discord-alert.js`)
- **Audit log gaps:** Alert if no entries for >1 hour during business hours
- **Retention policy violations:** Alert if records exceed retention_days + 7
- **Account deletion failures:** Alert on 500 from `/api/user/account`

---

## File Index (New/Modified)

| File | Type | Phase |
|------|------|-------|
| `server.js` | Modified | 1, 2, 4, 6, 7 |
| `src/components/AccountSettings.jsx` | Modified | 1 |
| `src/pages/PrivacyPage.jsx` | New | 4 |
| `src/pages/TermsPage.jsx` | New | 4 |
| `src/App.jsx` | Modified | 4 |
| `migrations/008_retention_policies.sql` | New | 2 |
| `migrations/009_students.sql` | New | 3 |
| `migrations/010_audit_logs.sql` | New | 6 |
| `lib/audit.js` | New | 6 |
| `lib/classroom-sync.js` | Modified | 3, 7 |
| `lib/classroom-grades.js` | Modified | 3, 7 |
| `scripts/ops/retention-cleanup.js` | New | 2 |
| `scripts/ops/generate-dpa.js` | New | 5 |
| `docs/DPA_TEMPLATE.md` | New | 5 |
| `content/legal/dpa/` | New dir | 5 |