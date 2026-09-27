import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BillingProvider, useBilling } from './contexts/BillingContext';
import { extractHandwriting, gradeSubmission, extractCustomRubric } from './lib/gradeHomework';
import { getAllRubrics, saveRubric, getRubric } from './lib/rubricStorage';
import TeacherInput from './components/TeacherInput';
import ResultsPanel from './components/ResultsPanel';
import Header from './components/Header';
import HubHeader from './components/HubHeader';
import SettingsPanel from './components/SettingsPanel';
import AuthPage from './components/AuthPage';
import AccountSettings from './components/AccountSettings';
import { BillingStatus } from './components/BillingStatus';
import BatchGradePage from './pages/BatchGradePage';
import ClassroomPage from './pages/ClassroomPage';
import HubLanding from './pages/HubLanding';
import FeedbackPage from './pages/FeedbackPage';
import DonatePage from './pages/DonatePage';
import ProductsPage from './pages/ProductsPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';

function GradingApp() {
  const { user, logout: authLogout } = useAuth();
  const { hasAccess, isTrialing, isActive, loading: billingLoading, subscribe, openPortal } = useBilling();

  // Initialize state from localStorage
  const [gradeLevel, setGradeLevel] = useState(() =>
    localStorage.getItem('hh_grade_level') || 'K'
  );
  const [subject, setSubject] = useState(() =>
    localStorage.getItem('hh_subject') || 'Math'
  );
  const [darkMode, setDarkMode] = useState(() =>
    localStorage.getItem('hh_dark_mode') === 'true'
  );
  const [stateCode, setStateCode] = useState(() =>
    localStorage.getItem('hh_state_code') || ''
  );

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem('hh_grade_level', gradeLevel);
  }, [gradeLevel]);

  useEffect(() => {
    localStorage.setItem('hh_subject', subject);
  }, [subject]);

  useEffect(() => {
    localStorage.setItem('hh_dark_mode', darkMode.toString());
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('hh_state_code', stateCode || '');
  }, [stateCode]);

  // Load preferences from server on mount
  useEffect(() => {
    if (user) {
      fetch('/api/user/preferences', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.preferences) {
            if (data.preferences.state_code) setStateCode(data.preferences.state_code);
            if (data.preferences.grade_level) setGradeLevel(data.preferences.grade_level);
            if (data.preferences.subject) setSubject(data.preferences.subject);
          }
        })
        .catch(console.error);
    }
  }, [user]);

  // Sync preferences to server when they change
  const savePreferences = useCallback(async () => {
    if (!user) return;
    await fetch('/api/user/preferences', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state_code: stateCode, grade_level: gradeLevel, subject })
    }).catch(console.error);
  }, [user, stateCode, gradeLevel, subject]);

  useEffect(() => { savePreferences(); }, [savePreferences, stateCode, gradeLevel, subject]);

  // Main state - support multiple images for multi-page assignments
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [rubric, setRubric] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [gradingResult, setGradingResult] = useState(null);
  const [error, setError] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('single'); // 'single', 'batch', 'classroom'

  // Custom rubric state
  const [useCustomRubric, setUseCustomRubric] = useState(false);
  const [customRubricImage, setCustomRubricImage] = useState(null);
  const [customRubricPreview, setCustomRubricPreview] = useState(null);
  const [savedRubrics, setSavedRubrics] = useState([]);
  const [isExtractingRubric, setIsExtractingRubric] = useState(false);
  const [showSaveRubricPrompt, setShowSaveRubricPrompt] = useState(false);
  const [newRubricName, setNewRubricName] = useState('');
  const [extractedCustomRubric, setExtractedCustomRubric] = useState(null);

  // Load saved rubrics on mount
  useEffect(() => {
    getAllRubrics().then(setSavedRubrics).catch(console.error);
  }, []);

  const handleGradeClick = async () => {
    if (images.length === 0) return;
    if (useCustomRubric && !customRubricImage && !extractedCustomRubric) return;

    setIsLoading(true);
    setError(null);
    setGradingResult(null);

    try {
      // Extract handwriting from all homework images (process each page)
      let allExtractedQuestions = [];
      for (let i = 0; i < images.length; i++) {
        const extractedQuestions = await extractHandwriting(images[i], gradeLevel, subject, stateCode);
        // Tag questions with page number for reference
        const taggedQuestions = extractedQuestions.map((q) => ({
          ...q,
          page: i + 1,
          question_number: `Page ${i + 1} - ${q.question_number}`
        }));
        allExtractedQuestions = [...allExtractedQuestions, ...taggedQuestions];
      }

      let finalRubric = null;

      if (useCustomRubric) {
        if (extractedCustomRubric) {
          finalRubric = JSON.stringify(extractedCustomRubric, null, 2);
        } else if (customRubricImage) {
          const customRubricData = await extractCustomRubric(customRubricImage);
          setExtractedCustomRubric(customRubricData);
          finalRubric = JSON.stringify(customRubricData, null, 2);
          setShowSaveRubricPrompt(true);
        }
      } else if (rubric.trim()) {
        finalRubric = rubric;
      }

      // Grade the submission (all pages combined)
      const result = await gradeSubmission(allExtractedQuestions, finalRubric, gradeLevel, subject, stateCode);
      setGradingResult(result);
    } catch (err) {
      // Handle auth expiry mid-session
      if (err.message === 'auth_required') {
        authLogout();
        return;
      }
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Add new files to existing ones
    files.forEach((file) => {
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setImages((prev) => [...prev, file]);
          setImagePreviews((prev) => [...prev, event.target.result]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleCustomRubricImageChange = async (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setCustomRubricImage(file);
      const reader = new FileReader();
      reader.onload = (event) => setCustomRubricPreview(event.target.result);
      reader.readAsDataURL(file);
      setExtractedCustomRubric(null);
      setShowSaveRubricPrompt(false);
    }
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    setGradingResult(null);
    setError(null);
  };

  const moveImage = (fromIndex, toIndex) => {
    setImages((prev) => {
      const newImages = [...prev];
      const [removed] = newImages.splice(fromIndex, 1);
      newImages.splice(toIndex, 0, removed);
      return newImages;
    });
    setImagePreviews((prev) => {
      const newPreviews = [...prev];
      const [removed] = newPreviews.splice(fromIndex, 1);
      newPreviews.splice(toIndex, 0, removed);
      return newPreviews;
    });
    setGradingResult(null);
    setError(null);
  };

  const removeCustomRubric = () => {
    setCustomRubricImage(null);
    setCustomRubricPreview(null);
    setExtractedCustomRubric(null);
    setShowSaveRubricPrompt(false);
  };

  const handleRubricChange = (value) => {
    setRubric(value);
    setGradingResult(null);
    setError(null);
  };

  const handleSaveRubric = async () => {
    if (!newRubricName.trim() || !extractedCustomRubric) return;

    try {
      await saveRubric(newRubricName, extractedCustomRubric, gradeLevel, subject);
      const updated = await getAllRubrics();
      setSavedRubrics(updated);
      setShowSaveRubricPrompt(false);
      setNewRubricName('');
    } catch (err) {
      console.error('Failed to save rubric:', err);
      setError('Failed to save rubric: ' + err.message);
    }
  };

  const handleSelectSavedRubric = async (id) => {
    try {
      const db = await getRubric(id);
      if (db) {
        setExtractedCustomRubric(db.data);
        setCustomRubricImage(null);
        setCustomRubricPreview(null);
        setShowSaveRubricPrompt(false);
      }
    } catch (err) {
      console.error('Failed to load saved rubric:', err);
      setError('Failed to load saved rubric: ' + err.message);
    }
  };

  const handleClearCustomRubric = () => {
    setCustomRubricImage(null);
    setCustomRubricPreview(null);
    setExtractedCustomRubric(null);
    setShowSaveRubricPrompt(false);
    setNewRubricName('');
  };

  const handleGradeAnother = () => {
    setGradingResult(null);
    setError(null);
    setImages([]);
    setImagePreviews([]);
    setRubric('');
    setCustomRubricImage(null);
    setCustomRubricPreview(null);
    setExtractedCustomRubric(null);
    setShowSaveRubricPrompt(false);
    setNewRubricName('');
  };

  const openSettings = () => setIsSettingsOpen(true);
  const closeSettings = () => setIsSettingsOpen(false);
  const openAccountSettings = () => setIsAccountSettingsOpen(true);
  const closeAccountSettings = () => setIsAccountSettingsOpen(false);

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-slate-900 transition-colors duration-200">
      <Header onOpenSettings={openSettings} onOpenAccountSettings={openAccountSettings} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {hasAccess ? (
            <>
              <div className="lg:col-span-2 mb-6">
                <div className="flex gap-4 border-b border-primary-200 dark:border-slate-700">
                  <button
                    onClick={() => setActiveTab('single')}
                    className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
                      activeTab === 'single'
                        ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                        : 'text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300'
                    }`}
                  >
                    Single Paper
                  </button>
                  <button
                    onClick={() => setActiveTab('batch')}
                    className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
                      activeTab === 'batch'
                        ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                        : 'text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300'
                    }`}
                  >
                    Batch Grading
                  </button>
                  <button
                    onClick={() => setActiveTab('classroom')}
                    className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
                      activeTab === 'classroom'
                        ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                        : 'text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300'
                    }`}
                  >
                    Google Classroom
                  </button>
                </div>
              </div>
              {activeTab === 'single' && (
                <>
                  <TeacherInput
                    images={images}
                    imagePreviews={imagePreviews}
                    rubric={rubric}
                    gradeLevel={gradeLevel}
                    subject={subject}
                    isLoading={isLoading}
                    onImageChange={handleImageChange}
                    onRemoveImage={removeImage}
                    onMoveImage={moveImage}
                    onRubricChange={handleRubricChange}
                    onSubjectChange={setSubject}
                    onGradeClick={handleGradeClick}
                    onOpenSettings={openSettings}
                    useCustomRubric={useCustomRubric}
                    setUseCustomRubric={setUseCustomRubric}
                    customRubricImage={customRubricImage}
                    customRubricPreview={customRubricPreview}
                    onCustomRubricImageChange={handleCustomRubricImageChange}
                    onRemoveCustomRubric={removeCustomRubric}
                    savedRubrics={savedRubrics}
                    onSaveRubric={handleSaveRubric}
                    onSelectSavedRubric={handleSelectSavedRubric}
                    onClearCustomRubric={handleClearCustomRubric}
                    isExtractingRubric={isExtractingRubric}
                    newRubricName={newRubricName}
                    setNewRubricName={setNewRubricName}
                    showSaveRubricPrompt={showSaveRubricPrompt}
                    setShowSaveRubricPrompt={setShowSaveRubricPrompt}
                    extractedCustomRubric={extractedCustomRubric}
                  />
                  <ResultsPanel
                    isLoading={isLoading}
                    gradingResult={gradingResult}
                    error={error}
                    onReset={handleGradeAnother}
                  />
                </>
              )}
              {activeTab === 'batch' && (
                <BatchGradePage />
              )}
              {activeTab === 'classroom' && (
                <ClassroomPage />
              )}
            </>
          ) : (
            <div className="lg:col-span-2">
              <BillingStatus />
            </div>
          )}
        </div>
      </main>
      {isSettingsOpen && (
        <SettingsPanel
          gradeLevel={gradeLevel}
          subject={subject}
          darkMode={darkMode}
          stateCode={stateCode}
          onGradeLevelChange={setGradeLevel}
          onSubjectChange={setSubject}
          onDarkModeChange={setDarkMode}
          onStateChange={setStateCode}
          onClose={closeSettings}
        />
      )}
      {isAccountSettingsOpen && (
        <AccountSettings onClose={closeAccountSettings} />
      )}
    </div>
  );
}

/**
 * Root App with routing and auth gating.
 * - / (hub landing) - public
 * - /products - public
 * - /feedback - public
 * - /donate - public
 * - /apps/homeworkhelper - requires auth + subscription
 * - /apps/lessonplanner - requires auth (beta)
 * - /apps/parentcomm - coming soon
 * - /auth - auth page
 * - /settings - requires auth
 * - /account - requires auth
 */
function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-50 dark:bg-slate-900 flex items-center justify-center transition-colors duration-200">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-primary-500 dark:text-primary-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public Hub Routes */}
        <Route path="/" element={user ? <GradingApp /> : <HubLanding />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/donate" element={<DonatePage />} />
        <Route path="/changelog" element={<div className="min-h-screen bg-primary-50 dark:bg-slate-950 flex items-center justify-center"><div className="text-center"><h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">Changelog</h1><p className="text-slate-600 dark:text-slate-400">Coming soon</p></div></div>} />
        
        {/* Auth Routes */}
        <Route path="/auth" element={<AuthPage />} />
        
        {/* Protected App Routes */}
        <Route
          path="/apps/homeworkhelper"
          element={
            user ? <GradingApp /> : <Navigate to="/auth?mode=register" replace />
          }
        />
        <Route
          path="/apps/lessonplanner"
          element={
            user ? (
              <div className="min-h-screen bg-primary-50 dark:bg-slate-950 flex items-center justify-center p-8">
                <div className="max-w-xl text-center">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-sage-100 dark:bg-sage-900/30 flex items-center justify-center">
                    <svg className="w-10 h-10 text-sage-600 dark:text-sage-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">LessonPlanner</h1>
                  <p className="text-slate-600 dark:text-slate-400 mb-6">Currently in private beta. Join the waitlist to get early access.</p>
                  <a href="/feedback" className="inline-flex items-center gap-2 px-6 py-3 bg-sage-500 hover:bg-sage-600 text-white font-semibold rounded-xl transition-colors">
                    Join Beta Waitlist
                  </a>
                </div>
              </div>
            ) : <Navigate to="/auth?mode=register" replace />
          }
        />
        <Route
          path="/apps/parentcomm"
          element={
            <div className="min-h-screen bg-primary-50 dark:bg-slate-950 flex items-center justify-center p-8">
              <div className="max-w-xl text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-warm-100 dark:bg-warm-900/30 flex items-center justify-center">
                  <svg className="w-10 h-10 text-warm-600 dark:text-warm-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">ParentComm</h1>
                <p className="text-slate-600 dark:text-slate-400 mb-6">Coming soon. Sign up for updates.</p>
                <a href="/feedback" className="inline-flex items-center gap-2 px-6 py-3 bg-warm-500 hover:bg-warm-600 text-white font-semibold rounded-xl transition-colors">
                  Notify Me
                </a>
              </div>
            </div>
          }
        />
        
        {/* Settings & Account */}
        <Route
          path="/settings"
          element={user ? <SettingsPanel onClose={() => window.history.back()} /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/account"
          element={user ? <AccountSettings onClose={() => window.history.back()} /> : <Navigate to="/auth" replace />}
        />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default function WrappedApp() {
  return (
    <AuthProvider>
      <BillingProvider>
        <App />
      </BillingProvider>
    </AuthProvider>
  );
}