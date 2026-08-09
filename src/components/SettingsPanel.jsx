import { useState, useEffect } from 'react'

export default function SettingsPanel({
  gradeLevel,
  subject,
  darkMode,
  stateCode,
  onGradeLevelChange,
  onSubjectChange,
  onDarkModeChange,
  onStateChange,
  onClose,
}) {
  const GRADE_LEVELS = ['K', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th']
  const SUBJECTS = ['Math', 'Reading', 'Writing', 'Science', 'Other']
  
  const US_STATES = [
    { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
  ]

  const [customSubjects, setCustomSubjects] = useState([])
  const [showAddSubject, setShowAddSubject] = useState(false)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    fetchCustomSubjects()
  }, [])

  const fetchCustomSubjects = async () => {
    try {
      const res = await fetch('/api/user/custom-subjects', {
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setCustomSubjects(data.customSubjects || [])
      }
    } catch (e) {
      console.error('Failed to fetch custom subjects:', e)
    }
  }

  const handleAddSubject = async (e) => {
    e.preventDefault()
    if (!newSubjectName.trim()) return
    
    setLoading(true)
    try {
      const res = await fetch('/api/user/custom-subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subjectName: newSubjectName.trim() })
      })
      if (res.ok) {
        const data = await res.json()
        setCustomSubjects(prev => [...prev, data.customSubject])
        setNewSubjectName('')
        setShowAddSubject(false)
        setToast({ type: 'success', message: 'Subject added!' })
      } else {
        const err = await res.json()
        setToast({ type: 'error', message: err.error || 'Failed to add subject' })
      }
    } catch (e) {
      setToast({ type: 'error', message: 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSubject = async (subjectCode) => {
    try {
      const res = await fetch(`/api/user/custom-subjects/${subjectCode}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (res.ok) {
        setCustomSubjects(prev => prev.filter(s => s.subject_code !== subjectCode))
        setToast({ type: 'success', message: 'Subject removed' })
      }
    } catch (e) {
      setToast({ type: 'error', message: 'Failed to delete subject' })
    }
  }

  const allSubjects = [...SUBJECTS, ...customSubjects.map(s => s.subject_name)]

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/30 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full bg-white dark:bg-slate-800 shadow-2xl animate-slide-in flex flex-col transition-colors duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-primary-100 dark:border-slate-700">
          <h2 id="settings-title" className="text-xl font-semibold text-primary-900 dark:text-primary-100">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-primary-500 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* State Setting */}
          <div>
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
              Your State
            </label>
            {!stateCode && (
              <div className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span>Please select your state so we know which rubric to use</span>
              </div>
            )}
            <p className="text-xs text-primary-500 dark:text-primary-400 mb-3">
              Set once — applies to all grading sessions for auto-rubric generation
            </p>
            <select
              value={stateCode || ''}
              onChange={(e) => onStateChange(e.target.value || null)}
              className="w-full px-4 py-3 border border-primary-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100 appearance-none transition-colors"
            >
              <option value="">SELECT</option>
              {US_STATES.map((state) => (
                <option key={state.code} value={state.code}>{state.name} ({state.code})</option>
              ))}
            </select>
          </div>

          {/* Grade Level Setting */}
          <div>
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
              My Class Grade Level
            </label>
            <p className="text-xs text-primary-500 dark:text-primary-400 mb-3">
              Set this once — it applies to all grading sessions
            </p>
            <select
              value={gradeLevel}
              onChange={(e) => onGradeLevelChange(e.target.value)}
              className="w-full px-4 py-3 border border-primary-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100 appearance-none transition-colors"
            >
              {GRADE_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          {/* Subject Setting */}
          <div>
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
              Default Subject
            </label>
            <p className="text-xs text-primary-500 dark:text-primary-400 mb-3">
              Remembered between sessions — change per grading session in the main panel
            </p>
            <select
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              className="w-full px-4 py-3 border border-primary-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100 appearance-none transition-colors"
            >
              {allSubjects.map((subj) => (
                <option key={subj} value={subj}>{subj}</option>
              ))}
            </select>
            
            {/* Custom subjects notice and add button */}
            <div className="mt-3 space-y-2">
              <p className="text-xs text-primary-600 dark:text-primary-400 font-medium flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                If your subject is not listed you can add it below
              </p>
              {showAddSubject ? (
                <form onSubmit={handleAddSubject} className="flex gap-2">
                  <input
                    type="text"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="Enter subject name (e.g., Art, Music, PE, Spanish)"
                    className="flex-1 px-3 py-2 border border-primary-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100 text-sm"
                    maxLength={100}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={loading || !newSubjectName.trim()}
                    className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                  >
                    {loading ? 'Adding...' : 'Add Subject'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddSubject(false); setNewSubjectName(''); }}
                    className="px-4 py-2 border border-primary-200 dark:border-slate-600 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-50 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setShowAddSubject(true)}
                  className="w-full px-4 py-2 border-2 border-dashed border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add a subject
                </button>
              )}
              
              {/* Custom subjects list */}
              {customSubjects.length > 0 && (
                <div className="mt-3 pt-3 border-t border-primary-100 dark:border-slate-700">
                  <p className="text-xs text-primary-500 dark:text-primary-400 mb-2">Your custom subjects:</p>
                  <div className="flex flex-wrap gap-1">
                    {customSubjects.map((s) => (
                      <span
                        key={s.subject_code}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-xs"
                      >
                        {s.subject_name}
                        <button
                          onClick={() => handleDeleteSubject(s.subject_code)}
                          className="p-0.5 hover:bg-primary-100 dark:hover:bg-primary-800 rounded transition-colors"
                          aria-label={`Remove ${s.subject_name}`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dark Mode Toggle */}
          <div>
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-3">
              Dark Mode
            </label>
            <button
              onClick={() => onDarkModeChange(!darkMode)}
              role="switch"
              aria-checked={darkMode}
              aria-label={darkMode ? 'Disable dark mode' : 'Enable dark mode'}
              className="relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
            >
              <span
                aria-hidden="true"
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition-transform ${
                  darkMode ? 'translate-x-8' : 'translate-x-0'
                }`}
              />
              <span className="sr-only">{darkMode ? 'On' : 'Off'}</span>
            </button>
            <p className="text-xs text-primary-500 dark:text-primary-400 mt-2">
              {darkMode ? 'Dark mode enabled' : 'Light mode enabled'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-primary-100 dark:border-slate-700">
          <p className="text-xs text-primary-400 dark:text-primary-500 text-center">
            Settings are saved automatically
          </p>
        </div>
      </div>
    </div>
  )
}