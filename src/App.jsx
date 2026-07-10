import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { extractHandwriting, gradeSubmission, extractCustomRubric } from './lib/gradeHomework';
import { getAllRubrics, saveRubric, getRubric } from './lib/rubricStorage';
import TeacherInput from './components/TeacherInput';
import ResultsPanel from './components/ResultsPanel';
import Header from './components/Header';
import SettingsPanel from './components/SettingsPanel';
import AuthPage from './components/AuthPage';
import AccountSettings from './components/AccountSettings';

function GradingApp() {
  const { user, logout: authLogout } = useAuth();

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

  // Main state
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [rubric, setRubric] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [gradingResult, setGradingResult] = useState(null);
  const [error, setError] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);

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
    if (!image) return;
    if (useCustomRubric && !customRubricImage && !extractedCustomRubric) return;

    setIsLoading(true);
    setError(null);
    setGradingResult(null);

    try {
      // Extract handwriting from homework image
      const extractedQuestions = await extractHandwriting(image, gradeLevel, subject);

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

      // Grade the submission
      const result = await gradeSubmission(extractedQuestions, finalRubric, gradeLevel, subject);
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
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setImage(file);
      const reader = new FileReader();
      reader.onload = (event) => setImagePreview(event.target.result);
      reader.readAsDataURL(file);
    }
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

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
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
    setImage(null);
    setImagePreview(null);
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
          <TeacherInput
            image={image}
            imagePreview={imagePreview}
            rubric={rubric}
            gradeLevel={gradeLevel}
            subject={subject}
            isLoading={isLoading}
            onImageChange={handleImageChange}
            onRubricChange={handleRubricChange}
            onSubjectChange={setSubject}
            onGradeClick={handleGradeClick}
            onRemoveImage={removeImage}
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
        </div>
      </main>
      {isSettingsOpen && (
        <SettingsPanel
          gradeLevel={gradeLevel}
          subject={subject}
          darkMode={darkMode}
          onGradeLevelChange={setGradeLevel}
          onSubjectChange={setSubject}
          onDarkModeChange={setDarkMode}
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
 * Root App with auth gating.
 * - loading: show nothing (fraction of a second while /api/auth/me resolves)
 * - no user: show AuthPage
 * - user present: show GradingApp
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

  if (!user) {
    return <AuthPage />;
  }

  return <GradingApp />;
}

export default function WrappedApp() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}