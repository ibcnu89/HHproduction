/**
 * Google Classroom Sync Engine
 * Handles syncing courses, assignments, and submissions
 */

import { getClient } from './db.js';
import { createClassroomClient, getValidClassroomTokens } from './google-classroom.js';

export async function startSyncLog(userId, syncType) {
  const client = await getClient();
  try {
    const result = await client.query(
      `INSERT INTO classroom_sync_log (user_id, sync_type, status, started_at)
       VALUES ($1, $2, 'started', NOW())
       RETURNING id`,
      [userId, syncType]
    );
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

export async function completeSyncLog(logId, status, errorMessage = null, stats = {}) {
  const client = await getClient();
  try {
    await client.query(
      `UPDATE classroom_sync_log
       SET status = $1,
           error_message = $2,
           items_processed = COALESCE($3, items_processed),
           items_created = COALESCE($4, items_created),
           items_updated = COALESCE($5, items_updated),
           items_failed = COALESCE($6, items_failed),
           completed_at = NOW()
       WHERE id = $7`,
      [status, errorMessage, stats.processed, stats.created, stats.updated, stats.failed, logId]
    );
  } finally {
    client.release();
  }
}

export async function syncUserClassroom(userId) {
  const logId = await startSyncLog(userId, 'full');
  const tokens = await getValidClassroomTokens(userId);
  if (!tokens) throw new Error('Not connected to Google Classroom');
  
  const classroom = createClassroomClient(tokens.access_token);
  let totalCreated = 0, totalUpdated = 0, totalFailed = 0, totalProcessed = 0;
  
  try {
    // 1. Sync courses
    const { created: cCreated, updated: cUpdated, failed: cFailed, processed: cProcessed } = 
      await syncCourses(userId, classroom);
    totalCreated += cCreated; totalUpdated += cUpdated; totalFailed += cFailed; totalProcessed += cProcessed;
    
    // 2. For each active course, sync assignments
    const courses = await getActiveCourses(userId);
    for (const course of courses) {
      const { created, updated, failed, processed } = await syncAssignments(userId, course.id, classroom);
      totalCreated += created; totalUpdated += updated; totalFailed += failed; totalProcessed += processed;
    }
    
    // 3. For each assignment, sync submissions
    const assignments = await getAssignmentsNeedingSync(userId);
    for (const assignment of assignments) {
      const { created, updated, failed, processed } = await syncSubmissions(userId, assignment.id, classroom);
      totalCreated += created; totalUpdated += updated; totalFailed += failed; totalProcessed += processed;
    }
    
    await completeSyncLog(logId, failed > 0 ? 'partial' : 'completed', null, {
      processed: totalProcessed,
      created: totalCreated,
      updated: totalUpdated,
      failed: totalFailed,
    });
    
    return { created: totalCreated, updated: totalUpdated, failed: totalFailed, processed: totalProcessed };
  } catch (error) {
    await completeSyncLog(logId, 'failed', error.message, {
      processed: totalProcessed,
      created: totalCreated,
      updated: totalUpdated,
      failed: totalFailed,
    });
    throw error;
  }
}

async function syncCourses(userId, classroom) {
  let created = 0, updated = 0, failed = 0, processed = 0;
  const client = await getClient();
  
  try {
    const response = await classroom.courses.list({
      teacherId: 'me',
      courseStates: ['ACTIVE', 'ARCHIVED'],
      pageSize: 100,
    });
    
    const courses = response.data.courses || [];
    
    for (const gcCourse of courses) {
      processed++;
      try {
        const result = await client.query(
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
             synced_at = NOW()
           RETURNING (xmax = 0) AS inserted`,
          [userId, gcCourse.id, gcCourse.name, gcCourse.section, gcCourse.subject,
           gcCourse.room, gcCourse.ownerId, gcCourse.enrollmentCode, gcCourse.courseState,
           gcCourse.alternateLink, gcCourse.guardianEnabled, gcCourse.calendarId]
        );
        if (result.rows[0].inserted) created++; else updated++;
      } catch (err) {
        failed++;
        console.error(`Failed to sync course ${gcCourse.id}:`, err.message);
      }
    }
  } finally {
    client.release();
  }
  return { created, updated, failed, processed };
}

async function getActiveCourses(userId) {
  const client = await getClient();
  try {
    const result = await client.query(
      `SELECT id, gc_course_id FROM classroom_courses 
       WHERE user_id = $1 AND course_state = 'ACTIVE'`,
      [userId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function syncAssignments(userId, courseId, classroom) {
  let created = 0, updated = 0, failed = 0, processed = 0;
  const client = await getClient();
  
  try {
    const courseResult = await client.query(
      'SELECT gc_course_id FROM classroom_courses WHERE id = $1', [courseId]
    );
    if (courseResult.rows.length === 0) return { created, updated, failed, processed };
    
    const gcCourseId = courseResult.rows[0].gc_course_id;
    
    const response = await classroom.courses.courseWork.list({
      courseId: gcCourseId,
      pageSize: 100,
    });
    
    const assignments = response.data.courseWork || [];
    
    for (const gcWork of assignments) {
      processed++;
      try {
        const dueDate = gcWork.dueDate 
          ? `${gcWork.dueDate.year}-${String(gcWork.dueDate.month).padStart(2,'0')}-${String(gcWork.dueDate.day).padStart(2,'0')}`
          : null;
        const dueTime = gcWork.dueTime 
          ? `${String(gcWork.dueTime.hours || 0).padStart(2,'0')}:${String(gcWork.dueTime.minutes || 0).padStart(2,'0')}`
          : null;
        
        const result = await client.query(
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
             synced_at = NOW()
           RETURNING (xmax = 0) AS inserted`,
          [courseId, gcWork.id, gcWork.title, gcWork.description, gcWork.state,
           gcWork.alternateLink, gcWork.creationTime, gcWork.updateTime,
           dueDate, dueTime, gcWork.maxPoints, gcWork.workType, gcWork.associatedWithDeveloper]
        );
        if (result.rows[0].inserted) created++; else updated++;
      } catch (err) {
        failed++;
        console.error(`Failed to sync assignment ${gcWork.id}:`, err.message);
      }
    }
  } finally {
    client.release();
  }
  return { created, updated, failed, processed };
}

async function getAssignmentsNeedingSync(userId) {
  const client = await getClient();
  try {
    const result = await client.query(
      `SELECT a.id 
       FROM classroom_assignments a
       JOIN classroom_courses c ON a.course_id = c.id
       WHERE c.user_id = $1 AND c.course_state = 'ACTIVE'
         AND (a.synced_at IS NULL OR a.synced_at < NOW() - INTERVAL '1 hour')`,
      [userId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function syncSubmissions(userId, assignmentId, classroom) {
  let created = 0, updated = 0, failed = 0, processed = 0;
  const client = await getClient();
  
  try {
    const assignmentResult = await client.query(
      `SELECT a.gc_coursework_id, c.gc_course_id 
       FROM classroom_assignments a
       JOIN classroom_courses c ON a.course_id = c.id
       WHERE a.id = $1`, [assignmentId]
    );
    if (assignmentResult.rows.length === 0) return { created, updated, failed, processed };
    
    const { gc_coursework_id: gcWorkId, gc_course_id: gcCourseId } = assignmentResult.rows[0];
    
    const response = await classroom.courses.courseWork.studentSubmissions.list({
      courseId: gcCourseId,
      courseWorkId: gcWorkId,
      pageSize: 200,
    });
    
    const submissions = response.data.studentSubmissions || [];
    
    for (const gcSub of submissions) {
      processed++;
      try {
        // Get student profile
        let studentName = null, studentEmail = null;
        try {
          const profile = await classroom.userProfiles.get({ userId: gcSub.userId });
          studentName = profile.data.name?.fullName;
          studentEmail = profile.data.emailAddress;
        } catch (e) { /* profile not accessible */ }
        
        const result = await client.query(
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
             synced_at = NOW()
           RETURNING (xmax = 0) AS inserted`,
          [assignmentId, gcSub.id, gcSub.userId, studentName, studentEmail,
           gcSub.state, gcSub.assignedGrade, gcSub.draftGrade, gcSub.late,
           gcSub.creationTime, gcSub.updateTime]
        );
        if (result.rows[0].inserted) created++; else updated++;
      } catch (err) {
        failed++;
        console.error(`Failed to sync submission ${gcSub.id}:`, err.message);
      }
    }
  } finally {
    client.release();
  }
  return { created, updated, failed, processed };
}