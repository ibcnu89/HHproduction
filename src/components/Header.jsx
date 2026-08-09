import { useState, useEffect } from 'react'

export default function Header({ onOpenSettings, darkMode, onDarkModeChange }) {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 12)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${
        isScrolled
          ? 'glass shadow-subtle'
          : 'bg-transparent'
      }`}
      role="banner"
    >
      <div className="container-editorial">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Brand */}
          <a href="/" className="flex items-center gap-3 group cursor-default">
            {/* Mark */}
            <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-glow-gold transition-transform duration-300 group-hover:scale-105">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            {/* Wordmark - visible on tablet+ */}
            <div className="hidden sm:block">
              <h1 className="text-display-sm text-ink font-bold tracking-tight leading-none">HomeworkHelper</h1>
              <p className="text-caption text-ink-muted mt-0.5">AI Grading Assistant</p>
            </div>
            <span className="sm:hidden text-display-sm text-ink font-bold tracking-tight">HH</span>
          </a>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={() => onDarkModeChange(!darkMode)}
              role="switch"
              aria-checked={darkMode}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="relative w-9 h-9 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink dark:hover:text-ink-50 hover:bg-ink-100 dark:hover:bg-ink-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gold-400/50 group"
            >
              {/* Sun */}
              <svg
                className={`w-4.5 h-4.5 absolute transition-all duration-300 ${
                  darkMode ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'
                }`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
              {/* Moon */}
              <svg
                className={`w-4.5 h-4.5 absolute transition-all duration-300 ${
                  darkMode ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'
                }`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </button>

            {/* Settings Button */}
            <button
              onClick={onOpenSettings}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink dark:hover:text-ink-50 hover:bg-ink-100 dark:hover:bg-ink-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gold-400/50"
              aria-label="Open settings"
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}