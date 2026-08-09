import { useState, useEffect } from 'react'
import { extractHandwriting, gradeSubmission, extractCustomRubric } from './lib/gradeHomework'
import { getAllRubrics, saveRubric, getRubric } from './lib/rubricStorage'
import TeacherInput from './components/TeacherInput'
import ResultsPanel from './components/ResultsPanel'
import Header from './components/Header'
import SettingsPanel from './components/SettingsPanel'

function App() {
  // Initialize state from localStorage
  const [gradeLevel, setGradeLevel] = useState(() => 
    localStorage.getItem('hh_grade_level') || 'K'
  )
  const [subject, setSubject] = useState(() => 
    localStorage.getItem('hh_subject') || 'Math'
  )
  const [darkMode, setDarkMode] = useState(() => 
    localStorage.getItem('hh_dark_mode') === 'true'
  )

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem('hh_grade_level', gradeLevel)
  }, [gradeLevel])

  useEffect(() => {
    localStorage.setItem('hh_subject', subject)
  }, [subject])

  useEffect(() => {
    localStorage.setItem('hh_dark_mode', darkMode.toString())
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  // Main state
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [rubric, setRubric] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [gradingResult, setGradingResult] = useState(null)
  const [error, setError] = useState(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Custom rubric state
  const [useCustomRubric, setUseCustomRubric] = useState(false)
  const [customRubricImage, setCustomRubricImage] = useState(null)
  const [customRubricPreview, setCustomRubricPreview] = useState(null)
  const [savedRubrics, setSavedRubrics] = useState([])

  // Load saved rubrics on mount
  useEffect(() => {
    getAllRubrics().then(setSavedRubrics).catch(console.error)
  }, [])

  const handleGradeClick = async () => {
    if (!image) return
    // Rubric is now OPTIONAL. Auto-rubric from IBSE standards when missing.
    // Only block when the teacher flipped the "use my own answer key" toggle but hasn't actually attached one yet.
    if (useCustomRubric && !customRubricImage) return

    setIsLoading(true)
    setError(null)
    setGradingResult(null)

    try {
      // Extract handwriting from homework image
      const extractedQuestions = await extractHandwriting(image, gradeLevel, subject)

      let finalRubric = null  // null = "let the backend auto-generate from standards"

      if (useCustomRubric) {
        if (customRubricImage) {
          const customRubricData = await extractCustomRubric(customRubricImage)
          finalRubric = JSON.stringify(customRubricData, null, 2)
          // Note: We are not saving the rubric automatically; the user can save it via the UI if needed.
          // But we have removed the save rubric UI, so we just use it for this grading.
        }
      } else if (rubric.trim()) {
        finalRubric = rubric
      }
      // else: leave as null -> backend auto-generates from IBSE standards

      // Grade the submission
      const result = await gradeSubmission(extractedQuestions, finalRubric, gradeLevel, subject)
      setGradingResult(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file && file.type.startsWith('image/')) {
      setImage(file)
      const reader = new FileReader()
      reader.onload = (event) => setImagePreview(event.target.result)
      reader.readAsDataURL(file)
    }
  }

  const handleCustomRubricImageChange = async (e) => {
    const file = e.target.files[0]
    if (file && file.type.startsWith('image/')) {
      setCustomRubricImage(file)
      const reader = new FileReader()
      reader.onload = (event) => setCustomRubricPreview(event.target.result)
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImage(null)
    setImagePreview(null)
    setGradingResult(null)
    setError(null)
  }

  const removeCustomRubric = () => {
    setCustomRubricImage(null)
    setCustomRubricPreview(null)
  }

  const handleRubricChange = (value) => {
    setRubric(value)
    setGradingResult(null)
    setError(null)
  }

  const handleGradeAnother = () => {
    setGradingResult(null)
    setError(null)
    setImage(null)
    setImagePreview(null)
    setRubric('')
    setCustomRubricImage(null)
    setCustomRubricPreview(null)
  }

  const openSettings = () => setIsSettingsOpen(true)
  const closeSettings = () => setIsSettingsOpen(false)

  return (
    <div className="min-h-screen bg-paper dark:bg-ink-deep transition-colors duration-200">
      <Header
        onOpenSettings={openSettings}
        darkMode={darkMode}
        onDarkModeChange={setDarkMode}
      />
      <main className="container-editorial pt-20 md:pt-24 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
          <TeacherInput
            image={image}
            imagePreview={imagePreview}
            _rubric={rubric}
            gradeLevel={gradeLevel}
            _subject={subject}
            isLoading={isLoading}
            onImageChange={handleImageChange}
            _onRubricChange={handleRubricChange}
            _onSubjectChange={setSubject}
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
            onSaveRubric={() => {}} // Placeholder, not used
            onSelectSavedRubric={() => {}} // Placeholder, not used
          />
          <div className="relative lg:sticky lg:top-24">
            <ResultsPanel 
              isLoading={isLoading} 
              gradingResult={gradingResult}
              error={error}
              onReset={handleGradeAnother}
            />
          </div>
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
    </div>
  )
}

export default App