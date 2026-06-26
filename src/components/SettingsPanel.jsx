export default function SettingsPanel({
  gradeLevel,
  subject,
  darkMode,
  onGradeLevelChange,
  onSubjectChange,
  onDarkModeChange,
  onClose,
}) {
  const GRADE_LEVELS = ['K', '1st', '2nd', '3rd', '4th', '5th']
  const SUBJECTS = ['Math', 'Reading', 'Writing', 'Science', 'Other']

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
              {SUBJECTS.map((subj) => (
                <option key={subj} value={subj}>{subj}</option>
              ))}
            </select>
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
            Settings are saved automatically to your browser
          </p>
        </div>
      </div>
    </div>
  )
}