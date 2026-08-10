# Google Classroom Integration Plan

## Overview
Add Google Classroom sync so teachers can:
1. Connect their Classroom account (OAuth)
2. Import classes & assignments
3. Pull student submissions
4. Grade via HomeworkHelper
5. Push scores/feedback back to Classroom

---

## 1. Database Schema Changes

### New Tables

```sql
-- Google Classroom OAuth tokens (per teacher)
CREATE TABLE IF NOT EXISTS google_classroom_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scope TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_gc_tokens_user ON google_classroom_tokens(user_id);

-- Synced Classroom courses
CREATE TABLE IF NOT EXISTS classroom_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gc_course_id VARCHAR(255) NOT NULL,  -- Google's course ID
  name VARCHAR(255) NOT NULL,
  section VARCHAR(100),
  subject VARCHAR(100),
  room VARCHAR(100),
  owner_id VARCHAR(255),
  enrollment_code VARCHAR(50),
  course_state VARCHAR(50),  -- ACTIVE, ARCHIVED, PROVISIONED, DECLINED
  alternate_link TEXT,
  guardian_enabled BOOLEAN DEFAULT FALSE,
  calendar_id VARCHAR(255),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, gc_course_id)
);

CREATE INDEX idx_gc_courses_user ON classroom_courses(user_id);
CREATE INDEX idx_gc_courses_gcid ON classroom_courses(gc_course_id);

-- Synced Classroom assignments (courseWork)
CREATE TABLE IF NOT EXISTS classroom_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES classroom_courses(id) ON DELETE CASCADE,
  gc_coursework_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  state VARCHAR(50),  -- PUBLISHED, DRAFT, DELETED
  alternate_link TEXT,
  creation_time TIMESTAMP WITH TIME ZONE,
  update_time TIMESTAMP WITH TIME ZONE,
  due_date DATE,
  due_time TIME,
  max_points INTEGER,
  work_type VARCHAR(50),  -- ASSIGNMENT, SHORT_ANSWER_QUESTION, MULTIPLE_CHOICE_QUESTION
  associated_with_developer BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(course_id, gc_coursework_id)
);

CREATE INDEX idx_gc_assignments_course ON classroom_assignments(course_id);
CREATE INDEX idx_gc_assignments_gcid ON classroom_assignments(gc_coursework_id);

-- Student submissions from Classroom
CREATE TABLE IF NOT EXISTS classroom_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES classroom_assignments(id) ON DELETE CASCADE,
  gc_submission_id VARCHAR(255) NOT NULL,
  gc_user_id VARCHAR(255) NOT NULL,  -- Google user ID of student
  student_name VARCHAR(255),
  student_email VARCHAR(255),
  state VARCHAR(50),  -- NEW, CREATED, TURNED_IN, RETURNED, RECLAIMED_BY_STUDENT
  assigned_grade DECIMAL(6,2),
  draft_grade DECIMAL(6,2),
  late BOOLEAN DEFAULT FALSE,
  creation_time TIMESTAMP WITH TIME ZONE,
  update_time TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Link to our grading session (nullable until graded)
  grading_session_id UUID REFERENCES batch_grading_sessions(id) ON DELETE SET NULL,
  UNIQUE(assignment_id, gc_submission_id)
);

CREATE INDEX idx_gc_submissions_assignment ON classroom_submissions(assignment_id);
CREATE INDEX idx_gc_submissions_student ON classroom_submissions(gc_user_id);
CREATE INDEX idx_gc_submissions_session ON classroom_submissions(grading_session_id);

-- Sync log for debugging/monitoring
CREATE TABLE IF NOT EXISTS classroom_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL,  -- 'courses', 'assignments', 'submissions', 'grades_push'
  status VARCHAR(20) NOT NULL,     -- 'started', 'completed', 'failed', 'partial'
  items_processed INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_gc_sync_log_user ON classroom_sync_log(user_id);
CREATE INDEX idx_gc_sync_log_type ON classroom_sync_log(sync_type);
```

---

## 2. Required OAuth Scopes

Add to Google OAuth config (separate from basic login):

```javascript
const CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me',        // for pushing grades
  'https://www.googleapis.com/auth/classroom.rosters.readonly',     // student names
  'https://www.googleapis.com/auth/classroom.profile.emails',       // student emails
  'https://www.googleapis.com/auth/classroom.profile.photos',       // student avatars
].join(' ');
```

**Note:** Requires Google Cloud project with Classroom API enabled and OAuth consent screen configured for these scopes.

---

## 3. Backend Architecture

### New Files Structure

```
lib/
├── google-classroom.js       # Core API client (token refresh, requests)
├── classroom-sync.js         # Sync orchestration (courses, assignments, submissions)
└── classroom-grades.js       # Push grades/feedback to Classroom

api/
├── classroom-connect.js      # POST /api/classroom/connect - start OAuth
├── classroom-callback.js     # GET /api/classroom/callback - handle OAuth return
├── classroom-status.js       # GET /api/classroom/status - connection status
├── classroom-disconnect.js   # DELETE /api/classroom/disconnect
├── classroom-sync.js         # POST /api/classroom/sync - manual sync trigger
├── classroom-courses.js      # GET /api/classroom/courses
├── classroom-assignments.js  # GET /api/classroom/courses/:courseId/assignments
├── classroom-submissions.js  # GET /api/classroom/assignments/:assignmentId/submissions
├── classroom-grade-push.js   # POST /api/classroom/submissions/:submissionId/grade
└── classroom-webhook.js      # POST /api/classroom/webhook - Google push notifications (optional)
```

### Google API Client (`lib/google-classroom.js`)

```javascript
import { google } from 'googleapis';
import { getClient } from './db.js';
import crypto from 'crypto';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.FRONTEND_URL}/api/classroom/callback`
);

const CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails',
  'https://www.googleapis.com/auth/classroom.profile.photos',
];

export function getClassroomAuthUrl(state) {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: CLASSROOM_SCOPES,
    prompt: 'consent',
    state: Buffer.from(JSON.stringify(state)).toString('base64'),
  });
}

export async function exchangeClassroomCode(code) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens; // { access_token, refresh_token, expiry_date, scope }
}

export async function getValidTokens(userId) {
  const client = await getClient();
  try {
    const result = await client.query(
      'SELECT access_token, refresh_token, expires_at FROM google_classroom_tokens WHERE user_id = $1',
      [userId]
    );
    if (result.rows.length === 0) return null;

    const { access_token, refresh_token, expires_at } = result.rows[0];
    
    // Refresh if expires within 5 minutes
    if (new Date(expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
      return await refreshClassroomTokens(userId, refresh_token);
    }
    return { access_token };
  } finally {
    client.release();
  }
}

export async function refreshClassroomTokens(userId, refreshToken) {
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  
  const client = await getClient();
  try {
    await client.query(
      `UPDATE google_classroom_tokens 
       SET access_token = $1, expires_at = $2, updated_at = NOW()
       WHERE user_id = $3`,
      [credentials.access_token, new Date(credentials.expiry_date), userId]
    );
    return { access_token: credentials.access_token };
  } finally {
    client.release();
  }
}

export function createClassroomClient(accessToken) {
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.classroom({ version: 'v1', auth: oauth2Client });
}
```

---

## 4. API Routes Implementation Plan

### Phase 1: OAuth Connection (Week 1)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/classroom/connect` | POST | Generate auth URL, redirect |
| `/api/classroom/callback` | GET | Exchange code, store tokens |
| `/api/classroom/status` | GET | Check connection, show linked account |
| `/api/classroom/disconnect` | DELETE | Revoke tokens, cleanup |

### Phase 2: Data Sync (Week 1-2)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/classroom/sync` | POST | Trigger full sync (courses → assignments → submissions) |
| `/api/classroom/courses` | GET | List synced courses |
| `/api/classroom/courses/:courseId/assignments` | GET | List assignments for course |
| `/api/classroom/assignments/:assignmentId/submissions` | GET | List submissions |

### Phase 3: Grading Integration (Week 2)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/classroom/submissions/:submissionId/grade` | POST | Grade submission via HH pipeline, push back to Classroom |
| `/api/classroom/webhook` | POST | Receive Google push notifications (optional) |

---

## 5. Sync Logic (`lib/classroom-sync.js`)

```javascript
export async function syncUserClassroom(userId) {
  const logId = await startSyncLog(userId, 'full');
  const tokens = await getValidTokens(userId);
  if (!tokens) throw new Error('Not connected to Google Classroom');
  
  const classroom = createClassroomClient(tokens.access_token);
  
  try {
    // 1. Sync courses
    const courses = await syncCourses(userId, classroom);
    
    // 2. For each active course, sync assignments
    for (const course of courses) {
      if (course.course_state === 'ACTIVE') {
        await syncAssignments(userId, course.id, classroom);
      }
    }
    
    // 3. For each assignment, sync submissions
    const assignments = await getAssignmentsNeedingSync(userId);
    for (const assignment of assignments) {
      await syncSubmissions(userId, assignment.id, classroom);
    }
    
    await completeSyncLog(logId, 'completed');
  } catch (error) {
    await completeSyncLog(logId, 'failed', error.message);
    throw error;
  }
}

async function syncCourses(userId, classroom) {
  const response = await classroom.courses.list({
    teacherId: 'me',
    courseStates: ['ACTIVE', 'ARCHIVED'],
    pageSize: 100,
  });
  
  const courses = response.data.courses || [];
  const client = await getClient();
  
  try {
    for (const gcCourse of courses) {
      await client.query(
        `INSERT INTO classroom_courses (user_id, gc_course_id, name, section, subject, room, owner_id, enrollment_code, course_state, alternate_link, guardian_enabled, calendar_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (user_id, gc_course_id) DO UPDATE SET
           name = EXCLUDED.name,
           section = EXCLUDED.section,
           subject = EXCLUDED.subject,
           room = EXCLUDED.room,
           course_state = EXCLUDED.course_state,
           alternate_link = EXCLUDED.alternate_link,
           guardian_enabled = EXCLUDED.guardian_enabled,
           calendar_id = EXCLUDED.calendar_id,
           synced_at = NOW()`,
        [userId, gcCourse.id, gcCourse.name, gcCourse.section, gcCourse.subject,
         gcCourse.room, gcCourse.ownerId, gcCourse.enrollmentCode, gcCourse.courseState,
         gcCourse.alternateLink, gcCourse.guardianEnabled, gcCourse.calendarId]
      );
    }
  } finally {
    client.release();
  }
  return courses;
}

async function syncAssignments(userId, courseId, classroom) {
  const client = await getClient();
  try {
    // Get our internal course UUID
    const courseResult = await client.query(
      'SELECT id, gc_course_id FROM classroom_courses WHERE id = $1', [courseId]
    );
    const { gc_course_id: gcCourseId } = courseResult.rows[0];
    
    const response = await classroom.courses.courseWork.list({
      courseId: gcCourseId,
      pageSize: 100,
    });
    
    const assignments = response.data.courseWork || [];
    
    for (const gcWork of assignments) {
      await client.query(
        `INSERT INTO classroom_assignments (course_id, gc_coursework_id, title, description, state, alternate_link, creation_time, update_time, due_date, due_time, max_points, work_type, associated_with_developer)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (course_id, gc_coursework_id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           state = EXCLUDED.state,
           alternate_link = EXCLUDED.alternate_link,
           creation_time = EXCLUDED.creation_time,
           update_time = EXCLUDED.update_time,
           due_date = EXCLUDED.due_date,
           due_time = EXCLUDED.due_time,
           max_points = EXCLUDED.max_points,
           work_type = EXCLUDED.work_type,
           synced_at = NOW()`,
        [courseId, gcWork.id, gcWork.title, gcWork.description, gcWork.state,
         gcWork.alternateLink, gcWork.creationTime, gcWork.updateTime,
         gcWork.dueDate ? `${gcWork.dueDate.year}-${String(gcWork.dueDate.month).padStart(2,'0')}-${String(gcWork.dueDate.day).padStart(2,'0')}` : null,
         gcWork.dueTime ? `${String(gcWork.dueTime.hours || 0).padStart(2,'0')}:${String(gcWork.dueTime.minutes || 0).padStart(2,'0')}` : null,
         gcWork.maxPoints, gcWork.workType, gcWork.associatedWithDeveloper]
      );
    }
  } finally {
    client.release();
  }
}

async function syncSubmissions(userId, assignmentId, classroom) {
  const client = await getClient();
  try {
    const assignmentResult = await client.query(
      `SELECT a.gc_coursework_id, c.gc_course_id 
       FROM classroom_assignments a
       JOIN classroom_courses c ON a.course_id = c.id
       WHERE a.id = $1`, [assignmentId]
    );
    if (assignmentResult.rows.length === 0) return;
    
    const { gc_coursework_id: gcWorkId, gc_course_id: gcCourseId } = assignmentResult.rows[0];
    
    const response = await classroom.courses.courseWork.studentSubmissions.list({
      courseId: gcCourseId,
      courseWorkId: gcWorkId,
      pageSize: 200,
    });
    
    const submissions = response.data.studentSubmissions || [];
    
    for (const gcSub of submissions) {
      // Get student profile
      let studentName = null, studentEmail = null;
      try {
        const profile = await classroom.userProfiles.get({ userId: gcSub.userId });
        studentName = profile.data.name?.fullName;
        studentEmail = profile.data.emailAddress;
      } catch (e) { /* profile not accessible */ }
      
      await client.query(
        `INSERT INTO classroom_submissions (assignment_id, gc_submission_id, gc_user_id, student_name, student_email, state, assigned_grade, draft_grade, late, creation_time, update_time)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (assignment_id, gc_submission_id) DO UPDATE SET
           student_name = EXCLUDED.student_name,
           student_email = EXCLUDED.student_email,
           state = EXCLUDED.state,
           assigned_grade = EXCLUDED.assigned_grade,
           draft_grade = EXCLUDED.draft_grade,
           late = EXCLUDED.late,
           creation_time = EXCLUDED.creation_time,
           update_time = EXCLUDED.update_time,
           synced_at = NOW()`,
        [assignmentId, gcSub.id, gcSub.userId, studentName, studentEmail,
         gcSub.state, gcSub.assignedGrade, gcSub.draftGrade, gcSub.late,
         gcSub.creationTime, gcSub.updateTime]
      );
    }
  } finally {
    client.release();
  }
}
```

---

## 6. Grade Push to Classroom (`lib/classroom-grades.js`)

```javascript
export async function pushGradeToClassroom(userId, submissionId, gradingResult) {
  const tokens = await getValidTokens(userId);
  if (!tokens) throw new Error('Not connected to Classroom');
  
  const classroom = createClassroomClient(tokens.access_token);
  
  // Get submission details
  const client = await getClient();
  try {
    const subResult = await client.query(
      `SELECT cs.gc_submission_id, ca.gc_coursework_id, cc.gc_course_id, cs.max_points
       FROM classroom_submissions cs
       JOIN classroom_assignments ca ON cs.assignment_id = ca.id
       JOIN classroom_courses cc ON ca.course_id = cc.id
       WHERE cs.id = $1`, [submissionId]
    );
    if (subResult.rows.length === 0) throw new Error('Submission not found');
    
    const { gc_submission_id: gcSubId, gc_coursework_id: gcWorkId, gc_course_id: gcCourseId, max_points } = subResult.rows[0];
    
    // Prepare grade
    const earnedPoints = gradingResult.overall.total_points_earned;
    const possiblePoints = gradingResult.overall.total_points_possible || max_points;
    const letterGrade = gradingResult.overall.letter_grade;
    
    // Create feedback text
    const feedback = formatFeedbackForClassroom(gradingResult);
    
    // Patch submission with draft grade
    await classroom.courses.courseWork.studentSubmissions.patch({
      courseId: gcCourseId,
      courseWorkId: gcWorkId,
      id: gcSubId,
      updateMask: 'draftGrade,assignedGrade',
      resource: {
        draftGrade: earnedPoints,
        assignedGrade: earnedPoints,  // Auto-return
      },
    });
    
    // Add private comment with feedback
    await classroom.courses.courseWork.studentSubmissions.addPrivateComment({
      courseId: gcCourseId,
      courseWorkId: gcWorkId,
      id: gcSubId,
      resource: {
        text: feedback,
      },
    });
    
    // Return the submission to student
    await classroom.courses.courseWork.studentSubmissions.return({
      courseId: gcCourseId,
      courseWorkId: gcWorkId,
      id: gcSubId,
    });
    
    // Update local record
    await client.query(
      `UPDATE classroom_submissions 
       SET assigned_grade = $1, draft_grade = $1, state = 'RETURNED', grading_session_id = $2, updated_at = NOW()
       WHERE id = $3`,
      [earnedPoints, gradingResult.sessionId, submissionId]
    );
    
    return { success: true, grade: earnedPoints };
  } finally {
    client.release();
  }
}

function formatFeedbackForClassroom(result) {
  let text = `HomeworkHelper AI Grading Results\\n\\n`;
  text += `Overall: ${result.overall.letter_grade} (${result.overall.total_points_earned}/${result.overall.total_points_possible})\\n`;
  text += `${result.overall.encouragement_message}\\n\\n`;
  
  result.questions.forEach((q, i) => {
    text += `Q${i+1}: ${q.question_text}\\n`;
    text += `  Your answer: ${q.student_answer}\\n`;
    text += `  Correct: ${q.correct_answer}\\n`;
    text += `  ${q.is_correct ? '✓' : '✗'} ${q.points_earned}/${q.points_possible} pts\\n`;
    if (q.feedback) text += `  Feedback: ${q.feedback}\\n`;
    text += `\\n`;
  });
  
  text += `--- Graded by HomeworkHelper AI ---`;
  return text;
}
```

---

## 7. Frontend Components (React)

### New Pages/Components

```
src/
├── pages/
│   ├── ClassroomConnect.tsx      # OAuth initiation + status
│   ├── ClassroomDashboard.tsx    # List courses, sync status
│   ├── ClassroomCourseView.tsx   # Assignments for a course
│   ├── ClassroomAssignmentView.tsx # Submissions + grade actions
│   └── ClassroomGrading.tsx      # Grade with HH, preview push
├── components/
│   ├── ClassroomCourseCard.tsx
│   ├── ClassroomAssignmentCard.tsx
│   ├── ClassroomSubmissionRow.tsx
│   ├── SyncProgressModal.tsx
│   └── GradePushConfirmModal.tsx
└── hooks/
    ├── useClassroomAuth.ts
    ├── useClassroomSync.ts
    └── useClassroomData.ts
```

### Key UX Flows

1. **Connect**: Settings → "Connect Google Classroom" → OAuth → returns to dashboard
2. **Sync**: Dashboard shows courses with "Sync" button; progress modal
3. **Grade**: Click assignment → see submissions → "Grade with HomeworkHelper" → review → "Push to Classroom"
4. **History**: View past sync logs, pushed grades

---

## 8. Cron Job: Daily Auto-Sync

Add to `scripts/ops/classroom-daily-sync.js`:

```javascript
#!/usr/bin/env node
/** Daily sync for all connected users (runs 6 AM) */

import pg from 'pg';
import { syncUserClassroom } from '../lib/classroom-sync.js';
import { sendDiscordAlert } from '../lib/discord.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    const users = await client.query(
      'SELECT user_id FROM google_classroom_tokens'
    );
    
    let success = 0, failed = 0;
    for (const { user_id } of users.rows) {
      try {
        await syncUserClassroom(user_id);
        success++;
      } catch (err) {
        console.error(`Sync failed for ${user_id}:`, err.message);
        failed++;
      }
    }
    
    await sendDiscordAlert(
      'Daily Classroom Sync Complete',
      `Synced ${success} users, ${failed} failed`,
      failed > 0 ? 'warning' : 'success'
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main();
```

---

## 9. Migration Steps

1. **Run schema migration** (append to `api/schema.sql`)
2. **Add Google Classroom scopes** to Google Cloud Console
3. **Install `googleapis` package**: `npm i googleapis`
4. **Implement backend routes** (Phases 1-3)
5. **Build frontend components**
6. **Add cron job** to GitHub Actions
7. **Test with 1-2 teacher accounts**
8. **Deploy**

---

## 10. Future-Proofing for Other Features

| Future Feature | Consideration | Implementation Note |
|----------------|---------------|---------------------|
| **Multi-state rubrics** | Store `state` on `classroom_courses` or `classroom_assignments` | Add `state_code` column (e.g., 'IL', 'CA') for rubric selection |
| **Printable PDF feedback** | Grading result already has structured feedback | Reuse `formatFeedbackForClassroom` logic for PDF generation |
| **Batch grading** | Classroom submissions map 1:1 to batch sessions | Link `grading_session_id` on `classroom_submissions` |

**Key principle:** Keep Classroom data normalized and separate from core grading. The `classroom_submissions.grading_session_id` FK links Classroom → HH grading without coupling.

---

## 11. Estimated Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Schema + OAuth | 2 days | DB tables, connect/disconnect working |
| Sync engine | 3 days | Courses/assignments/submissions syncing |
| Grade push | 2 days | Push grades + feedback to Classroom |
| Frontend | 3 days | Dashboard, course view, grading UI |
| Cron + Polish | 2 days | Daily sync, error handling, monitoring |
| **Total** | **~12 days** | **Production-ready** |

---

## 12. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Google API quota limits | Medium | Implement exponential backoff, batch requests |
| Token refresh failures | Low | Alert on Discord, auto-disconnect UI |
| Submission state mismatches | Medium | Idempotent sync, compare `updateTime` |
| Grade push rejected by teacher | Low | Draft grade first, teacher confirms in Classroom |
| Student privacy (FERPA) | High | Only store GC IDs, minimal PII; no roster export |

---

*End of Plan — Ready for implementation*