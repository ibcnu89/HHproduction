export default function SettingsPanel({
  gradeLevel,
  subject,
  darkMode,
  onGradeLevelChange,
  onSubjectChange,
  onDarkModeChange,
  onClose,
}) {
  const GRADE_LEVELS = ['K', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th']
  const SUBJECTS = ['Math', 'Reading', 'Writing', 'Science', 'Other']

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose()
  }

  return (
    <div
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/20 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface dark:bg-ink-card shadow-strong animate-slide-right flex flex-col transition-colors duration-200"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 h-14 border-b border-subtle dark:border-ink-700">
          <h2 id="settings-title" className="text-display-sm text-ink font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink dark:hover:text-ink-50 hover:bg-ink-100 dark:hover:bg-ink-800 transition-all duration-200"
            aria-label="Close settings"
          >
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* Grade Level */}
          <div>
            <label className="block text-body-sm font-semibold text-ink mb-1">
              My Class Grade Level
            </label>
            <p className="text-caption text-ink-muted mb-3">
              Remembered between sessions
            </p>
            <select
              value={gradeLevel}
              onChange={(e) => onGradeLevelChange(e.target.value)}
              className="input-select"
            >
              {GRADE_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-body-sm font-semibold text-ink mb-1">
              Default Subject
            </label>
            <p className="text-caption text-ink-muted mb-3">
              Applied to all grading sessions
            </p>
            <select
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              className="input-select"
            >
              {SUBJECTS.map((subj) => (
                <option key={subj} value={subj}>{subj}</option>
              ))}
            </select>
          </div>

          {/* Dark Mode */}
          <div>
            <label className="block text-body-sm font-semibold text-ink mb-3">
              Theme
            </label>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-body-sm text-ink">
                  {darkMode ? 'Dark mode' : 'Light mode'}
                </p>
                <p className="text-caption text-ink-muted mt-0.5">
                  {darkMode ? 'Easier on the eyes at night' : 'Clean, paper-inspired look'}
                </p>
              </div>
              <button
                onClick={() => onDarkModeChange(!darkMode)}
                role="switch"
                aria-checked={darkMode}
                aria-label={darkMode ? 'Disable dark mode' : 'Enable dark mode'}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:ring-offset-2 dark:focus:ring-offset-ink-900 ${
                  darkMode ? 'bg-gold-500' : 'bg-ink-300 dark:bg-ink-600'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-soft transition-transform duration-200 ${
                    darkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 h-12 flex items-center justify-center border-t border-subtle dark:border-ink-700">
          <p className="text-caption text-ink-subtle">Settings saved automatically</p>
        </div>
      </div>
    </div>
  )
}