/**
 * Google Classroom Grade Push
 * Pushes grades and feedback from HomeworkHelper back to Classroom
 */

import { getClient } from './db.js';
import { createClassroomClient, getValidClassroomTokens } from './google-classroom.js';

export async function pushGradeToClassroom(userId, submissionId, gradingResult) {
  const tokens = await getValidClassroomTokens(userId);
  if (!tokens) throw new Error('Not connected to Google Classroom');
  
  const classroom = createClassroomClient(tokens.access_token);
  
  // Get submission details
  const client = await getClient();
  try {
    const subResult = await client.query(
      `SELECT cs.gc_submission_id, ca.gc_coursework_id, cc.gc_course_id, ca.max_points, cs.grading_session_id
       FROM classroom_submissions cs
       JOIN classroom_assignments ca ON cs.assignment_id = ca.id
       JOIN classroom_courses cc ON ca.course_id = cc.id
       WHERE cs.id = $1`, [submissionId]
    );
    if (subResult.rows.length === 0) throw new Error('Submission not found');
    
    const { gc_submission_id: gcSubId, gc_coursework_id: gcWorkId, gc_course_id: gcCourseId, max_points, grading_session_id } = subResult.rows[0];
    
    // Prepare grade
    const earnedPoints = gradingResult.overall?.total_points_earned ?? 0;
    const possiblePoints = gradingResult.overall?.total_points_possible ?? max_points;
    const letterGrade = gradingResult.overall?.letter_grade ?? 'N/A';
    
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
      [earnedPoints, grading_session_id, submissionId]
    );
    
    return { success: true, grade: earnedPoints, letterGrade };
  } finally {
    client.release();
  }
}

function formatFeedbackForClassroom(result) {
  let text = `HomeworkHelper AI Grading Results\n\n`;
  text += `Overall: ${result.overall?.letter_grade ?? 'N/A'} (${result.overall?.total_points_earned ?? 0}/${result.overall?.total_points_possible ?? 0})\n`;
  text += `${result.overall?.encouragement_message ?? 'Keep up the good work!'}\n\n`;
  
  if (result.questions && Array.isArray(result.questions)) {
    result.questions.forEach((q, i) => {
      text += `Q${i+1}: ${q.question_text ?? 'Question'}\n`;
      text += `  Your answer: ${q.student_answer ?? 'N/A'}\n`;
      text += `  Correct: ${q.correct_answer ?? 'N/A'}\n`;
      text += `  ${q.is_correct ? '✓' : '✗'} ${q.points_earned ?? 0}/${q.points_possible ?? 0} pts\n`;
      if (q.feedback) text += `  Feedback: ${q.feedback}\n`;
      text += `\n`;
    });
  }
  
  text += `--- Graded by HomeworkHelper AI ---`;
  return text;
}

export async function pushBulkGradesToClassroom(userId, submissionIds, gradingResults) {
  const results = [];
  for (let i = 0; i < submissionIds.length; i++) {
    try {
      const result = await pushGradeToClassroom(userId, submissionIds[i], gradingResults[i]);
      results.push({ submissionId: submissionIds[i], ...result });
      // Rate limit: 100ms between pushes
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      results.push({ submissionId: submissionIds[i], success: false, error: err.message });
    }
  }
  return results;
}