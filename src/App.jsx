import { useState, useEffect } from 'react'
import { extractHandwriting, gradeSubmission } from './lib/gradeHomework'
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

  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [rubric, setRubric] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [gradingResult, setGradingResult] = useState(null)
  const [error, setError] = useState(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const handleGradeClick = async () => {
    if (!image || !rubric.trim()) return
    
    setIsLoading(true)
    setError(null)
    setGradingResult(null)

    try {
      const extractedQuestions = await extractHandwriting(image, gradeLevel, subject)
      const result = await gradeSubmission(extractedQuestions, rubric, gradeLevel, subject)
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

  const removeImage = () => {
    setImage(null)
    setImagePreview(null)
    setGradingResult(null)
    setError(null)
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
  }

  const openSettings = () => setIsSettingsOpen(true)
  const closeSettings = () => setIsSettingsOpen(false)

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-slate-900 transition-colors duration-200">
      <Header onOpenSettings={openSettings} />
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
    </div>
  )
}

export default App