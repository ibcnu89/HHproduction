/**
 * Classroom Dashboard - Main view for connected users
 */

import { useState } from 'react';
import { useClassroomCourses, useClassroomAssignments, useClassroomSubmissions, useClassroomSync, useClassroomSyncLog } from '../hooks/useClassroom';

export default function ClassroomDashboard({ onBack }) {
  const { courses, loading: coursesLoading, error: coursesError, refetch: refetchCourses } = useClassroomCourses();
  const { sync, loading: syncLoading, result: syncResult } = useClassroomSync();
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);

  const { assignments, loading: assignmentsLoading } = useClassroomAssignments(selectedCourseId);
  const { submissions, loading: submissionsLoading } = useClassroomSubmissions(selectedAssignmentId);

  const handleCourseSelect = (courseId) => {
    setSelectedCourseId(courseId);
    setSelectedAssignmentId(null);
  };

  const handleAssignmentSelect = (assignmentId) => {
    setSelectedAssignmentId(assignmentId);
  };

  const handleSync = async () => {
    await sync();
    refetchCourses();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Google Classroom</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your classes, assignments, and student work</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSync}
            disabled={syncLoading}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {syncLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Now
              </>
            )}
          </button>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 border border-primary-200 dark:border-slate-700 text-primary-600 dark:text-primary-400 font-medium rounded-lg hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors"
            >
              Back
            </button>
          )}
        </div>
      </div>

      {/* Sync Result Toast */}
      {syncResult && (
        <div className={`p-4 rounded-lg border ${syncResult.failed > 0 ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800' : 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{syncResult.failed > 0 ? 'Sync completed with issues' : 'Sync completed successfully'}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Processed: {syncResult.processed} • Created: {syncResult.created} • Updated: {syncResult.updated} • Failed: {syncResult.failed}
              </p>
            </div>
            <button onClick={() => setTimeout(() => window.location.reload(), 100)} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">Refresh</button>
          </div>
        </div>
      )}

      {/* Courses View */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-primary-200 dark:border-slate-700">
        <div className="p-4 border-b border-primary-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Your Classes</h2>
        </div>
        {coursesLoading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading classes...</div>
        ) : coursesError ? (
          <div className="p-8 text-center text-red-500 dark:text-red-400">{coursesError}</div>
        ) : courses.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            No classes found. Click "Sync Now" to import from Google Classroom.
          </div>
        ) : (
          <div className="divide-y divide-primary-200 dark:divide-slate-700">
            {courses.map(course => (
              <button
                key={course.id}
                onClick={() => handleCourseSelect(course.id)}
                className={`w-full p-4 text-left transition-colors ${selectedCourseId === course.id ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-primary-50 dark:hover:bg-slate-700/50'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{course.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {course.section && `${course.section} • `}{course.subject || 'No subject'}{course.room && ` • Room ${course.room}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 text-xs rounded-full ${course.course_state === 'ACTIVE' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                      {course.course_state}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Synced: {new Date(course.synced_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Assignments View */}
      {selectedCourseId && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-primary-200 dark:border-slate-700">
          <div className="p-4 border-b border-primary-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Assignments</h2>
            <button onClick={() => setSelectedCourseId(null)} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">← Back to classes</button>
          </div>
          {assignmentsLoading ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading assignments...</div>
          ) : assignments.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">No assignments in this class.</div>
          ) : (
            <div className="divide-y divide-primary-200 dark:divide-slate-700">
              {assignments.map(assignment => (
                <button
                  key={assignment.id}
                  onClick={() => handleAssignmentSelect(assignment.id)}
                  className={`w-full p-4 text-left transition-colors ${selectedAssignmentId === assignment.id ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-primary-50 dark:hover:bg-slate-700/50'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{assignment.title}</p>
                      {assignment.description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{assignment.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className={`px-2 py-0.5 rounded-full ${assignment.state === 'PUBLISHED' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                          {assignment.state}
                        </span>
                        {assignment.due_date && <span>Due: {new Date(assignment.due_date).toLocaleDateString()}</span>}
                        {assignment.max_points && <span>Max: {assignment.max_points} pts</span>}
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submissions View */}
      {selectedAssignmentId && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-primary-200 dark:border-slate-700">
          <div className="p-4 border-b border-primary-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Student Submissions</h2>
            <button onClick={() => setSelectedAssignmentId(null)} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">← Back to assignments</button>
          </div>
          {submissionsLoading ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading submissions...</div>
          ) : submissions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">No submissions yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-primary-200 dark:border-slate-700">
                    <th className="p-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student</th>
                    <th className="p-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">State</th>
                    <th className="p-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Grade</th>
                    <th className="p-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Last Updated</th>
                    <th className="p-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-200 dark:divide-slate-700">
                  {submissions.map(sub => (
                    <tr key={sub.id} className="hover:bg-primary-50 dark:hover:bg-slate-700/50">
                      <td className="p-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{sub.student_name || 'Unknown'}</div>
                        {sub.student_email && <div className="text-sm text-slate-500 dark:text-slate-400">{sub.student_email}</div>}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${sub.state === 'TURNED_IN' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : sub.state === 'RETURNED' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : sub.state === 'NEW' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                          {sub.state}
                        </span>
                      </td>
                      <td className="p-3">
                        {sub.assigned_grade !== null ? (
                          <span className="font-medium text-slate-900 dark:text-slate-100">{sub.assigned_grade} pts</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-3 text-sm text-slate-500 dark:text-slate-400">
                        {sub.update_time ? new Date(sub.update_time).toLocaleDateString() : '—'}
                      </td>
                      <td className="p-3 text-right">
                        {sub.state !== 'RETURNED' && (
                          <button
                            className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            Grade & Push
                          </button>
                        )}
                        {sub.state === 'RETURNED' && (
                          <span className="text-xs text-green-600 dark:text-green-400">Returned</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}