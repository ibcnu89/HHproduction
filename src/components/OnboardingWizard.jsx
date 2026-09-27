import { Fragment, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBilling } from '../contexts/BillingContext';
import { useClassroomStatus, useClassroomConnect, useClassroomSync, useClassroomCourses, useClassroomAssignments } from '../hooks/useClassroom';

/**
 * OnboardingWizard — 7-step guided flow for new teachers
 * Steps:
 *  1. Welcome (value prop)
 *  2. Connect Google Classroom
 *  3. Select Course
 *  4. Select Assignment
 *  5. Configure Grading (grade level, subject)
 *  6. Test Grade (upload 1-3 papers)
 *  7. Review Results → Complete
 */

const STEPS = [
  { id: 'welcome', label: 'Welcome', icon: '👋' },
  { id: 'connect', label: 'Connect Classroom', icon: '🔗' },
  { id: 'course', label: 'Pick Course', icon: '📚' },
  { id: 'assignment', label: 'Pick Assignment', icon: '📝' },
  { id: 'config', label: 'Configure', icon: '⚙️' },
  { id: 'grade', label: 'Test Grade', icon: '✨' },
  { id: 'complete', label: 'All Set!', icon: '🎉' },
];

const GRADE_LEVELS = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SUBJECTS = ['Math', 'Reading', 'Writing', 'Science', 'Social Studies', 'English', 'History', 'Other'];

export default function OnboardingWizard({ onComplete, onSkip }) {
  const { user } = useAuth();
  const { isActive, isTrialing } = useBilling();
  const { status, refetch: refetchClassroom } = useClassroomStatus();
  const { connect } = useClassroomConnect();
  const { sync, loading: syncLoading, error: syncError } = useClassroomSync();
  const { courses, loading: coursesLoading, error: coursesError, refetch: refetchCourses } = useClassroomCourses();
  const { assignments, loading: assignmentsLoading, error: assignmentsError, refetch: refetchAssignments } = useClassroomAssignments(selectedCourseId);

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  const [gradeLevel, setGradeLevel] = useState('5');
  const [subject, setSubject] = useState('Math');
  const [testImages, setTestImages] = useState([]);
  const [isGrading, setIsGrading] = useState(false);
  const [gradingResult, setGradingResult] = useState(null);
  const [gradingError, setGradingError] = useState(null);
  const [syncTriggered, setSyncTriggered] = useState(false);

  // Auto-advance when Classroom connects
  useEffect(() => {
    if (status.connected && currentStep === 1 && !syncTriggered) {
      setSyncTriggered(true);
      handleSync();
    }
  }, [status.connected, currentStep, syncTriggered]);

  // Auto-advance after sync completes
  useEffect(() => {
    if (syncTriggered && !syncLoading && sync) {
      if (courses.length > 0) {
        setCurrentStep(2); // Move to course selection
      }
    }
  }, [syncTriggered, syncLoading, sync, courses.length]);

  // Fetch courses when connected
  useEffect(() => {
    if (status.connected && courses.length === 0 && !coursesLoading) {
      refetchCourses();
    }
  }, [status.connected, courses.length, coursesLoading, refetchCourses]);

  // Fetch assignments when course selected
  useEffect(() => {
    if (selectedCourseId) {
      setSelectedAssignmentId(null);
      refetchAssignments();
    }
  }, [selectedCourseId, refetchAssignments]);

  const handleConnect = async () => {
    await connect('/classroom');
  };

  const handleSync = async () => {
    setSyncTriggered(true);
    await sync();
    if (sync) {
      await refetchClassroom();
      await refetchCourses();
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGradeTest = async () => {
    if (testImages.length === 0) return;
    
    setIsGrading(true);
    setGradingError(null);
    setGradingResult(null);

    try {
      const formData = new FormData();
      testImages.forEach(img => formData.append('images', img.file));
      formData.append('gradeLevel', gradeLevel);
      formData.append('subject', subject);

      const res = await fetch('/api/batch-grade', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Grading failed');
      }

      // For test grade, just take first result
      setBatchId(data.batch_id);
      // Poll for results
      pollForResults(data.batch_id, testImages.length);
    } catch (err) {
      setGradingError(err.message);
      setIsGrading(false);
    }
  };

  const [batchId, setBatchId] = useState(null);

  const pollForResults = async (id, expectedCount) => {
    const maxPolls = 60; // 2 minutes max
    let polls = 0;
    
    const poll = async () => {
      if (polls >= maxPolls) {
        setGradingError('Grading timed out. Please try again.');
        setIsGrading(false);
        return;
      }
      
      try {
        const res = await fetch(`/api/batch-grade/status/${id}`, { credentials: 'include' });
        const data = await res.json();
        
        if (data.status === 'completed') {
          const resultsRes = await fetch(`/api/batch-grade/results/${id}`, { credentials: 'include' });
          const resultsData = await resultsRes.json();
          setGradingResult(resultsData.results?.[0] || resultsData);
          setIsGrading(false);
          handleNext(); // Auto-advance to complete
        } else if (data.status === 'failed') {
          setGradingError(data.error || 'Grading failed');
          setIsGrading(false);
        } else {
          polls++;
          setTimeout(poll, 2000);
        }
      } catch (err) {
        polls++;
        setTimeout(poll, 2000);
      }
    };
    
    poll();
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    const newImages = files.slice(0, 3).map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
    }));
    setTestImages(prev => [...prev, ...newImages].slice(0, 3));
  };

  const removeTestImage = (index) => {
    setTestImages(prev => prev.filter((_, i) => i !== index));
  };

  const step = STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEPS.length - 1;
  const canGoNext = getCanProceed();

  function getCanProceed() {
    switch (currentStep) {
      case 0: return true; // Welcome
      case 1: return status.connected; // Connect Classroom
      case 2: return !!selectedCourseId; // Pick Course
      case 3: return !!selectedAssignmentId; // Pick Assignment
      case 4: return !!gradeLevel && !!subject; // Configure
      case 5: return testImages.length > 0 && !isGrading; // Test Grade
      case 6: return true; // Complete
      default: return false;
    }
  }

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: return renderWelcome();
      case 1: return renderConnectClassroom();
      case 2: return renderPickCourse();
      case 3: return renderPickAssignment();
      case 4: return renderConfigure();
      case 5: return renderTestGrade();
      case 6: return renderComplete();
      default: return null;
    }
  };

  function renderWelcome() {
    return (
      <div className="text-center space-y-8">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <svg className="w-10 h-10 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-ink dark:text-paper mb-2">Welcome to HomeworkHelper</h2>
          <p className="text-lg text-ink-muted dark:text-paper-muted max-w-xl mx-auto">
            Grade handwritten homework in seconds with AI. Connect Google Classroom, pick an assignment, and watch the magic happen.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
          {[
            { icon: '📸', title: 'Snap & Upload', desc: 'Photo of handwritten work' },
            { icon: '🤖', title: 'AI Grades', desc: 'Against standards & rubrics' },
            { icon: '📊', title: 'Instant Feedback', desc: 'Per-question + overall grade' },
          ].map((item, i) => (
            <div key={i} className="p-4 rounded-xl bg-surface dark:bg-ink-card border border-subtle dark:border-ink-700">
              <div className="text-3xl mb-2">{item.icon}</div>
              <h4 className="font-semibold text-ink dark:text-paper mb-1">{item.title}</h4>
              <p className="text-sm text-ink-muted dark:text-paper-muted">{item.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-ink-subtle dark:text-paper-subtle">
          This setup takes ~3 minutes. You can skip and explore on your own.
        </p>
      </div>
    );
  }

  function renderConnectClassroom() {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center ${
            status.connected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-primary-100 dark:bg-primary-900/30'
          }`}>
            <svg className={`w-8 h-8 ${status.connected ? 'text-green-600 dark:text-green-400' : 'text-primary-600 dark:text-primary-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h3 className="mt-4 text-xl font-semibold text-ink dark:text-paper">
            {status.connected ? 'Classroom Connected!' : 'Connect Google Classroom'}
          </h3>
          <p className="text-ink-muted dark:text-paper-muted mt-2 max-w-md mx-auto">
            {status.connected 
              ? 'Great! Now we\'ll sync your classes and assignments.' 
              : 'Import your classes, assignments, and student work automatically. One-click sync.'}
          </p>
        </div>

        {!status.connected ? (
          <button
            onClick={handleConnect}
            disabled={connectLoading}
            className="w-full sm:w-auto mx-auto px-8 py-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {connectLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,4.177-5.445,4.646v2.941c5.082-0.476,9-4.312,9-9.344C21,8.563,16.607,3.5,11.187,3.5S1.5,8.563,1.5,14.044c0,1.798,0.517,3.45,1.382,4.818l4.394-4.393c0.372-0.372,0.974-0.372,1.346,0l3.322,3.321C13.021,17.313,12.636,14.288,12.545,10.239z" /></svg>
                Connect Google Classroom
              </>
            )}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-green-700 dark:text-green-300 font-medium">Google Classroom connected</span>
            </div>
            <button
              onClick={handleSync}
              disabled={syncLoading}
              className="w-full sm:w-auto mx-auto px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {syncLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Syncing classes & assignments...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Sync Now
                </>
              )}
            </button>
            {syncError && (
              <p className="text-sm text-warm-600 dark:text-warm-400 text-center">{syncError}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderPickCourse() {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-ink dark:text-paper">Pick a Course</h3>
          <p className="text-ink-muted dark:text-paper-muted mt-1">Select the class you want to grade</p>
        </div>

        {coursesLoading ? (
          <div className="flex justify-center py-8">
            <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
        ) : coursesError ? (
          <div className="text-center py-8 text-warm-600 dark:text-warm-400">
            <p>{coursesError}</p>
            <button onClick={() => refetchCourses()} className="mt-3 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">Retry</button>
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-16 h-16 mx-auto text-ink-subtle dark:text-paper-subtle mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h4 className="text-lg font-medium text-ink dark:text-paper mb-2">No courses found</h4>
            <p className="text-ink-muted dark:text-paper-muted mb-4">Create a course in Google Classroom, then sync again.</p>
            <button onClick={handleSync} disabled={syncLoading} className="px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600">Sync Again</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {courses.filter(c => c.course_state === 'ACTIVE').map(course => (
              <button
                key={course.id}
                onClick={() => setSelectedCourseId(course.id)}
                className={`p-5 rounded-xl border-2 text-left transition-all ${
                  selectedCourseId === course.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-subtle dark:border-ink-700 hover:border-primary-300 dark:hover:border-primary-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-ink dark:text-paper">{course.name}</h4>
                    {course.section && <p className="text-sm text-ink-muted dark:text-paper-muted">{course.section}</p>}
                    {course.subject && <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">{course.subject}</p>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderPickAssignment() {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-ink dark:text-paper">Pick an Assignment</h3>
          <p className="text-ink-muted dark:text-paper-muted mt-1">Choose which assignment to grade</p>
        </div>

        {assignmentsLoading ? (
          <div className="flex justify-center py-8">
            <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
        ) : assignmentsError ? (
          <div className="text-center py-8 text-warm-600 dark:text-warm-400">
            <p>{assignmentsError}</p>
            <button onClick={() => refetchAssignments()} className="mt-3 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">Retry</button>
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-16 h-16 mx-auto text-ink-subtle dark:text-paper-subtle mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <h4 className="text-lg font-medium text-ink dark:text-paper mb-2">No assignments yet</h4>
            <p className="text-ink-muted dark:text-paper-muted mb-4">Create an assignment in Google Classroom, then sync.</p>
            <button onClick={handleSync} disabled={syncLoading} className="px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600">Sync Again</button>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl mx-auto">
            {assignments
              .filter(a => a.state === 'PUBLISHED')
              .map(assignment => (
                <button
                  key={assignment.id}
                  onClick={() => setSelectedAssignmentId(assignment.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedAssignmentId === assignment.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-subtle dark:border-ink-700 hover:border-primary-300 dark:hover:border-primary-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-ink dark:text-paper">{assignment.title}</h4>
                      <div className="flex items-center gap-3 mt-1 text-sm text-ink-muted dark:text-paper-muted">
                        {assignment.due_date && (
                          <span>📅 Due {new Date(assignment.due_date).toLocaleDateString()}</span>
                        )}
                        {assignment.max_points && (
                          <span>⭐ {assignment.max_points} pts</span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          assignment.state === 'PUBLISHED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {assignment.state}
                        </span>
                      </div>
                    </div>
                    {selectedAssignmentId === assignment.id && (
                      <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>
    );
  }

  function renderConfigure() {
    return (
      <div className="space-y-6 max-w-xl mx-auto">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-ink dark:text-paper">Configure Grading</h3>
          <p className="text-ink-muted dark:text-paper-muted mt-1">Set grade level and subject for accurate standards alignment</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink dark:text-paper mb-2">Grade Level</label>
            <select
              value={gradeLevel}
              onChange={e => setGradeLevel(e.target.value)}
              className="w-full px-4 py-3 border border-subtle dark:border-ink-700 rounded-xl bg-surface dark:bg-ink-card text-ink dark:text-paper focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {GRADE_LEVELS.map(g => (
                <option key={g} value={g}>{g === 'K' ? 'Kindergarten' : `${g}${g === '1' ? 'st' : g === '2' ? 'nd' : g === '3' ? 'rd' : 'th'} Grade`}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink dark:text-paper mb-2">Subject</label>
            <select
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-4 py-3 border border-subtle dark:border-ink-700 rounded-xl bg-surface dark:bg-ink-card text-ink dark:text-paper focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {SUBJECTS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-primary-600 dark:text-primary-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-medium text-primary-900 dark:text-primary-100">Standards Alignment</h4>
              <p className="text-sm text-primary-700 dark:text-primary-300 mt-1">
                HomeworkHelper will grade against {subject} standards for {gradeLevel === 'K' ? 'Kindergarten' : `${gradeLevel}${gradeLevel === '1' ? 'st' : gradeLevel === '2' ? 'nd' : gradeLevel === '3' ? 'rd' : 'th'} grade`}. You can also provide a custom rubric when uploading papers.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderTestGrade() {
    return (
      <div className="space-y-6 max-w-xl mx-auto">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-ink dark:text-paper">Test Grade</h3>
          <p className="text-ink-muted dark:text-paper-muted mt-1">Upload 1-3 student papers to see the magic</p>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-ink dark:text-paper mb-2">
            Upload Papers ({testImages.length}/3)
          </label>
          <div
            className={`border-2 border-dashed rounded-xl p-6 transition-colors ${
              testImages.length > 0
                ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/10'
                : 'border-subtle dark:border-ink-700 hover:border-primary-300 dark:hover:border-primary-700'
            }`}
            onClick={() => document.getElementById('test-image-input').click()}
          >
            <input
              id="test-image-input"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="hidden"
            />
            {testImages.length === 0 ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <svg className="w-12 h-12 text-ink-subtle dark:text-paper-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <div>
                  <p className="font-medium text-ink dark:text-paper">Click or drag & drop</p>
                  <p className="text-sm text-ink-muted dark:text-paper-muted">JPG, PNG, WebP — up to 3 images, 10MB each</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {testImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-subtle dark:border-ink-700">
                      <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
                      <button
                        onClick={e => { e.stopPropagation(); removeTestImage(idx); }}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                {testImages.length < 3 && (
                  <button
                    onClick={e => { e.stopPropagation(); document.getElementById('test-image-input').click(); }}
                    className="w-full py-2 px-4 border border-dashed border-subtle dark:border-ink-700 rounded-lg text-ink-muted dark:text-paper-muted hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    + Add more (max 3)
                  </button>
                )}
              </div>
            )}
          </div>

          {gradingError && (
            <div className="p-3 rounded-lg bg-warm-50 dark:bg-warm-900/30 border border-warm-200 dark:border-warm-800 text-warm-700 dark:text-warm-300 text-sm">
              {gradingError}
            </div>
          )}

          <button
            onClick={handleGradeTest}
            disabled={testImages.length === 0 || isGrading}
            className="w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all disabled:opacity-50"
            style={{ 
              background: testImages.length > 0 && !isGrading 
                ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' 
                : '#d1d5db',
              color: testImages.length > 0 && !isGrading ? 'white' : '#9ca3af'
            }}
          >
            {isGrading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Grading with AI...
              </span>
            ) : (
              `Grade ${testImages.length} Paper${testImages.length > 1 ? 's' : ''}`
            )}
          </button>

          {isGrading && (
            <div className="text-center text-sm text-ink-muted dark:text-paper-muted">
              <div className="w-full bg-primary-100 dark:bg-primary-900/30 rounded-full h-2 mb-2">
                <div className="bg-primary-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
              <p>AI is reading handwriting and applying standards...</p>
            </div>
          )}
        </div>

        {gradingResult && (
          <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3 mb-3">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className="font-semibold text-green-800 dark:text-green-200">Grading Complete!</h4>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-green-700 dark:text-green-300 font-medium">Overall Grade</p>
                <p className="text-2xl font-bold text-green-800 dark:text-green-200">{gradingResult.overall?.letter_grade || 'N/A'}</p>
              </div>
              <div>
                <p className="text-green-700 dark:text-green-300 font-medium">Score</p>
                <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                  {gradingResult.overall?.total_points_earned || 0} / {gradingResult.overall?.total_points_possible || 0}
                </p>
              </div>
            </div>
            <p className="text-green-600 dark:text-green-400 text-sm mt-3">{gradingResult.overall?.encouragement_message || 'Great work!'}</p>
          </div>
        )}
      </div>
    );
  }

  function renderComplete() {
    return (
      <div className="text-center space-y-8">
        <div className="w-24 h-24 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <svg className="w-12 h-12 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-ink dark:text-paper mb-2">You're All Set!</h2>
          <p className="text-lg text-ink-muted dark:text-paper-muted max-w-xl mx-auto">
            HomeworkHelper is ready. Grade papers, sync with Classroom, and save hours every week.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto text-sm">
          {[
            { icon: '✅', title: 'Classroom Connected', desc: 'Classes & assignments synced' },
            { icon: '📝', title: 'Test Graded', desc: 'AI grading works end-to-end' },
            { icon: '🚀', title: 'Ready to Go', desc: 'Start grading batches now' },
          ].map((item, i) => (
            <div key={i} className="p-4 rounded-xl bg-surface dark:bg-ink-card border border-subtle dark:border-ink-700">
              <div className="text-2xl mb-1">{item.icon}</div>
              <h4 className="font-semibold text-ink dark:text-paper mb-1">{item.title}</h4>
              <p className="text-ink-muted dark:text-paper-muted">{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onComplete}
            className="px-8 py-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors w-full sm:w-auto"
          >
            Start Grading
          </button>
          <button
            onClick={onSkip}
            className="px-8 py-4 bg-primary-100 dark:bg-slate-700 text-primary-700 dark:text-primary-300 font-semibold rounded-xl hover:bg-primary-200 dark:hover:bg-slate-600 transition-colors w-full sm:w-auto"
          >
            Explore First
          </button>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-subtle dark:border-ink-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-ink dark:text-paper">Setup HomeworkHelper</h2>
          </div>
          {!isFirstStep && !isLastStep && (
            <button onClick={onSkip} className="text-sm text-ink-muted dark:text-paper-muted hover:text-ink dark:hover:text-paper">
              Skip
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="px-4 py-3 border-b border-subtle dark:border-ink-700">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((s, i) => (
              <Fragment key={s.id}>
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                    i < currentStep
                      ? 'bg-primary-500 text-white'
                      : i === currentStep
                      ? 'bg-primary-500 text-white ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-slate-800'
                      : 'bg-subtle dark:bg-ink-700 text-ink-muted dark:text-paper-muted'
                  }`}>
                    {i < currentStep ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      s.icon
                    )}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`w-12 h-0.5 mx-1 ${
                      i < currentStep ? 'bg-primary-500' : 'bg-subtle dark:bg-ink-700'
                    }`} />
                  )}
                </div>
              </Fragment>
            ))}
          </div>
          <div className="w-full bg-subtle dark:bg-ink-700 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-primary-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${((currentStep) / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
          <p className="text-xs text-center text-ink-muted dark:text-paper-muted mt-2">
            Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].label}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderStepContent()}
        </div>

        {/* Footer Navigation */}
        {!isLastStep && (
          <div className="p-4 border-t border-subtle dark:border-ink-700 flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={isFirstStep}
              className="px-4 py-2 text-ink-muted dark:text-paper-muted hover:text-ink dark:hover:text-paper disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={!canGoNext}
              className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFirstStep ? 'Get Started' : currentStep === 5 ? 'Grade & Continue' : 'Continue'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}