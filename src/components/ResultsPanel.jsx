export default function ResultsPanel({ isLoading, gradingResult, error, onReset }) {
  // ─── Error State ───────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-surface dark:bg-ink-card rounded-2xl border border-subtle dark:border-ink-700 shadow-soft overflow-hidden transition-colors duration-200 h-full flex flex-col animate-fade-in">
        <div className="px-6 pt-6 pb-4 border-b border-subtle dark:border-ink-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-warm-subtle dark:bg-warm-900/20 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-warm" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h2 className="text-display-sm text-ink font-bold">Results</h2>
              <p className="text-caption text-ink-muted">Grading feedback</p>
            </div>
          </div>
        </div>
        <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-warm-50 dark:bg-warm-900/20 flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-warm-400 dark:text-warm-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-display-sm text-ink font-bold mb-2">Something went wrong</p>
          <p className="text-body-sm text-ink-muted mb-6 max-w-sm">{error}</p>
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-warm-500 text-white font-semibold hover:bg-warm-600 transition-all duration-200 shadow-soft"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // ─── Empty / Idle State ────────────────────────────────────
  if (!gradingResult) {
    return (
      <div className="bg-surface dark:bg-ink-card rounded-2xl border border-subtle dark:border-ink-700 shadow-soft overflow-hidden transition-colors duration-200 h-full flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-subtle dark:border-ink-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold-subtle dark:bg-gold-900/20 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-display-sm text-ink font-bold">Results</h2>
              <p className="text-caption text-ink-muted">Grading feedback</p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-3xl bg-gold-faint dark:bg-gold-900/10 flex items-center justify-center mb-6 animate-float">
            <svg className="w-10 h-10 text-gold-300 dark:text-gold-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.25">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-display-sm text-ink font-bold mb-1.5">Waiting for submission</p>
          <p className="text-body-sm text-ink-muted max-w-xs">
            Upload a homework image and click "Grade This Homework" to see detailed feedback
          </p>

          {/* Skeleton preview cards */}
          <div className="w-full mt-10 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2 animate-pulse opacity-30">
                <div className="w-3 h-3 rounded-full shimmer" />
                <div className={`h-3 rounded shimmer ${i === 1 ? 'w-2/3' : i === 2 ? 'w-1/2' : 'w-5/6'}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-surface/90 dark:bg-ink-card/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center animate-fade-in rounded-2xl">
            <div className="text-center max-w-xs">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gold-100 dark:bg-gold-900/20 flex items-center justify-center animate-pulse-gold">
                <svg className="w-8 h-8 text-gold-500 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <p className="text-display-sm text-ink font-bold">AI is grading…</p>
              <p className="text-body-sm text-ink-muted mt-2">Analyzing student work against standards</p>
              <div className="mt-6 flex justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gold-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-gold-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-gold-600 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Grading Results ──────────────────────────────────────
  const { questions = [], overall = {} } = gradingResult
  const { total_points_earned = 0, total_points_possible = 0, letter_grade = 'N/A', encouragement_message = '' } = overall
  const percentage = total_points_possible > 0 ? Math.round((total_points_earned / total_points_possible) * 100) : 0

  // Grade color
  const gradeColor = letter_grade.startsWith('A')
    ? 'from-sage-400 to-sage-600'
    : letter_grade.startsWith('B')
    ? 'from-sage-300 to-sage-500'
    : letter_grade.startsWith('C')
    ? 'from-warm-300 to-warm-500'
    : letter_grade.startsWith('D')
    ? 'from-warm-400 to-warm-600'
    : 'from-rose-300 to-rose-500'

  const gradeBg = letter_grade.startsWith('A') || letter_grade.startsWith('B')
    ? 'bg-sage-subtle dark:bg-sage-900/20 border-sage-soft dark:border-sage-800/40'
    : letter_grade.startsWith('C')
    ? 'bg-warm-subtle dark:bg-warm-900/20 border-warm-soft dark:border-warm-800/40'
    : 'bg-rose-subtle dark:bg-rose-900/20 border-rose-soft dark:border-rose-800/40'

  return (
    <div className="bg-surface dark:bg-ink-card rounded-2xl border border-subtle dark:border-ink-700 shadow-soft overflow-hidden transition-colors duration-200 h-full flex flex-col animate-slide-up">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-subtle dark:border-ink-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sage-subtle dark:bg-sage-900/20 flex items-center justify-center">
            <svg className="w-4.5 h-4.5 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-display-sm text-ink font-bold">Results</h2>
            <p className="text-caption text-ink-muted">{questions.length} question{questions.length !== 1 ? 's' : ''} graded</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* ─── Overall Grade Card ─── */}
        <div className={`rounded-xl p-6 border ${gradeBg} animate-scale-in`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div className="flex items-center gap-5">
              {/* Grade letter - large circular badge */}
              <div className="relative">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-br ${gradeColor} shadow-strong`}>
                  <span className="text-display-lg text-white font-bold drop-shadow-sm">{letter_grade}</span>
                </div>
              </div>
              <div>
                <p className="text-display-sm text-ink font-bold">Overall Grade</p>
                <p className="text-body text-ink-muted mt-0.5">
                  {total_points_earned} / {total_points_possible} points
                </p>
                {/* Bar */}
                <div className="mt-3 w-36 h-1.5 rounded-full bg-ink-200 dark:bg-ink-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${gradeColor} transition-all duration-1000 ease-out`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
            {encouragement_message && (
              <div className="text-left sm:text-right pt-2 sm:pt-0 sm:border-l border-subtle dark:border-ink-700 sm:pl-5">
                <p className="text-body-sm text-ink-muted italic leading-relaxed">
                  &ldquo;{encouragement_message}&rdquo;
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ─── Per-Question Feedback ─── */}
        {questions.length > 0 ? (
          <div className="space-y-3">
            {questions.map((q, idx) => {
              const isCorrect = q.is_correct === true
              return (
                <div
                  key={q.question_number}
                  className={`rounded-xl border-2 p-5 transition-all duration-300 animate-slide-up ${
                    isCorrect
                      ? 'border-sage-soft dark:border-sage-800/40 bg-sage-faint dark:bg-sage-900/10'
                      : 'border-warm-soft dark:border-warm-800/40 bg-warm-faint dark:bg-warm-900/10'
                  }`}
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <div className="flex items-start gap-4">
                    {/* Status icon */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      isCorrect
                        ? 'bg-sage-100 text-sage-600 dark:bg-sage-800/40 dark:text-sage-300'
                        : 'bg-warm-100 text-warm-600 dark:bg-warm-800/40 dark:text-warm-300'
                    }`}>
                      {isCorrect ? (
                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Question header */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-body-sm font-semibold text-ink">
                          Question {q.question_number}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-semibold ${
                          isCorrect
                            ? 'bg-sage-100 text-sage-700 dark:bg-sage-800/30 dark:text-sage-300'
                            : 'bg-warm-100 text-warm-700 dark:bg-warm-800/30 dark:text-warm-300'
                        }`}>
                          {q.points_earned}/{q.points_possible} pts
                        </span>
                      </div>

                      {/* Student answer */}
                      <p className="text-body-sm text-ink-muted">
                        <span className="font-medium text-ink">Student:</span> {q.student_answer || '[blank]'}
                      </p>

                      {/* Feedback */}
                      <div className={`p-3.5 rounded-lg border ${
                        isCorrect
                          ? 'bg-sage-50 border-sage-200 dark:bg-sage-900/20 dark:border-sage-800/30'
                          : 'bg-warm-50 border-warm-200 dark:bg-warm-900/20 dark:border-warm-800/30'
                      }`}>
                        <p className={`text-body-sm ${isCorrect ? 'text-sage-700 dark:text-sage-200' : 'text-warm-700 dark:text-warm-200'}`}>
                          {q.feedback}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-subtle dark:border-ink-600 p-10 text-center">
            <p className="text-body text-ink-muted">No questions were found in this submission.</p>
          </div>
        )}

        {/* ─── Grade Another Button ─── */}
        <div className="pt-2">
          <button
            onClick={onReset}
            className="w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl border-2 border-dashed border-subtle dark:border-ink-600 text-body-sm font-semibold text-ink-muted hover:text-ink dark:hover:text-ink-50 hover:border-gold-300 dark:hover:border-gold-600 hover:bg-gold-faint dark:hover:bg-gold-900/10 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Grade Another Homework
          </button>
        </div>
      </div>
    </div>
  )
}