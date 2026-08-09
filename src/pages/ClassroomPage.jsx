/**
 * Classroom Page - Main entry point for Classroom feature
 */

import { useState, useEffect } from 'react';
import { useClassroomStatus } from '../hooks/useClassroom';
import ClassroomConnect from '../components/ClassroomConnect';
import ClassroomDashboard from '../components/ClassroomDashboard';
import ClassroomGradingModal from '../components/ClassroomGradingModal';

export default function ClassroomPage() {
  const { status, refetch } = useClassroomStatus();
  const [showDashboard, setShowDashboard] = useState(false);
  const [gradingSubmission, setGradingSubmission] = useState(null);

  useEffect(() => {
    if (status.connected) {
      setShowDashboard(true);
    } else {
      setShowDashboard(false);
    }
  }, [status.connected]);

  const handleConnected = () => {
    refetch();
    setShowDashboard(true);
  };

  const handleGradeSubmission = (submission) => {
    setGradingSubmission(submission);
  };

  const handleGraded = (submissionId, result) => {
    // Could trigger a toast notification here
    console.log('Graded:', submissionId, result);
  };

  if (status.loading) {
    return (
      <div className="min-h-screen bg-primary-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-primary-500 dark:text-primary-400">Loading Classroom...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showDashboard ? (
          <ClassroomDashboard
            onBack={() => setShowDashboard(false)}
            onGradeSubmission={handleGradeSubmission}
          />
        ) : (
          <ClassroomConnect onConnected={handleConnected} />
        )}
      </div>

      {gradingSubmission && (
        <ClassroomGradingModal
          submission={gradingSubmission}
          onClose={() => setGradingSubmission(null)}
          onGraded={handleGraded}
        />
      )}
    </div>
  );
}