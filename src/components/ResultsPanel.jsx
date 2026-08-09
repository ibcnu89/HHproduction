export default function ResultsPanel({ isLoading, gradingResult, error, onReset }) {
  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-primary-100 dark:border-slate-700 h-full flex flex-col transition-colors duration-200">
        <h2 className="text-xl font-semibold text-primary-900 dark:text-primary-100 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-warm-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Results
        </h2>
        <div className="flex-1 border-2 border-dashed border-warm-200 dark:border-warm-800 rounded-xl p-8 text-center bg-warm-50/50 dark:bg-warm-900/20">
          <svg className="w-16 h-16 mx-auto text-warm-300 dark:text-warm-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-warm-700 dark:text-warm-300 font-medium text-lg">Something went wrong</p>
          <p className="text-warm-500 dark:text-warm-400 text-sm mt-2 max-w-xs mx-auto">{error}</p>
          <button 
            onClick={onReset}
            className="mt-4 px-4 py-2 bg-warm-500 text-white rounded-lg hover:bg-warm-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!gradingResult) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-primary-100 dark:border-slate-700 h-full flex flex-col transition-colors duration-200">
        <h2 className="text-xl font-semibold text-primary-900 dark:text-primary-100 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-warm-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Results
        </h2>

        <div className="flex-1 space-y-4">
          {/* Main placeholder card */}
          <div className="border-2 border-dashed border-primary-200 dark:border-primary-800 rounded-xl p-8 text-center bg-primary-50/50 dark:bg-primary-900/20">
            <svg className="w-16 h-16 mx-auto text-primary-200 dark:text-primary-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-primary-500 dark:text-primary-400 font-medium text-lg">Results will appear here</p>
            <p className="text-primary-400 dark:text-primary-500 text-sm mt-1">Upload homework and click "Grade This Homework" to see feedback</p>
          </div>

          {/* Skeleton cards for per-question feedback */}
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-primary-100 dark:border-slate-700 rounded-xl p-5 bg-primary-50/30 dark:bg-primary-900/20">
                <div className="space-y-3">
                  <div className="h-5 w-3/4 shimmer rounded" />
                  <div className="h-4 w-1/2 shimmer rounded" />
                  <div className="h-4 w-5/6 shimmer rounded" />
                  <div className="h-8 w-full shimmer rounded mt-2" />
                </div>
              </div>
            ))}
          </div>

          {isLoading && (
            <div className="border border-warm-200 dark:border-warm-800 bg-warm-50 dark:bg-warm-900/20 rounded-xl p-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <svg className="animate-spin h-8 w-8 text-warm-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-warm-700 dark:text-warm-300 font-medium">AI is grading the homework...</p>
                <p className="text-warm-500 dark:text-warm-400 text-sm">This may take a moment</p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Render actual grading results
  const { questions = [], overall = {} } = gradingResult
  const { total_points_earned = 0, total_points_possible = 0, letter_grade = 'N/A', encouragement_message = '' } = overall
  const percentage = total_points_possible > 0 ? Math.round((total_points_earned / total_points_possible) * 100) : 0

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-primary-100 dark:border-slate-700 h-full flex flex-col transition-colors duration-200">
      <h2 className="text-xl font-semibold text-primary-900 dark:text-primary-100 mb-6 flex items-center gap-2">
        <svg className="w-5 h-5 text-warm-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Results
      </h2>

      <div className="flex-1 space-y-4 overflow-y-auto">
        {/* Overall Grade Card */}
        <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/30 rounded-xl p-6 border border-primary-200 dark:border-primary-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg bg-gradient-to-br ${
                letter_grade.startsWith('A') || letter_grade.startsWith('B')
                  ? 'from-sage-300 to-sage-400'
                  : letter_grade.startsWith('C')
                  ? 'from-warm-300 to-warm-400'
                  : 'from-red-300 to-red-400'
              }">
                <span className="text-3xl font-bold text-white">{letter_grade}</span>
              </div>
              <div>
                <p className="text-primary-900 dark:text-primary-100 font-semibold text-lg">Overall Grade</p>
                <p className="text-primary-600 dark:text-primary-400">{total_points_earned} / {total_points_possible} points ({percentage}%)</p>
              </div>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-warm-700 dark:text-warm-300 font-medium text-sm italic">{encouragement_message}</p>
            </div>
          </div>
        </div>

        {/* Per-Question Feedback Cards */}
        {questions.length > 0 ? (
          <div className="space-y-4">
            {questions.map((q, _index) => {
              const isCorrect = q.is_correct === true
              
              return (
                <div key={q.question_number} className={`border-2 rounded-xl p-5 transition-all ${
                  isCorrect 
                    ? 'border-sage-200 bg-sage-50 dark:border-sage-800 dark:bg-sage-900/30' 
                    : 'border-warm-200 bg-warm-50 dark:border-warm-800 dark:bg-warm-900/30'
                }`}>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-primary-900 dark:text-primary-100 font-medium">Question {q.question_number}</span>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        isCorrect ? 'bg-sage-100 text-sage-600 dark:bg-sage-800 dark:text-sage-300' : 'bg-warm-100 text-warm-600 dark:bg-warm-800 dark:text-warm-300'
                      }`}>
                        {isCorrect ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                        isCorrect ? 'bg-sage-100 text-sage-700 dark:bg-sage-800 dark:text-sage-300' : 'bg-warm-100 text-warm-700 dark:bg-warm-800 dark:text-warm-300'
                      }`}>
                        {q.points_earned}/{q.points_possible} pts
                      </span>
                    </div>
                    
                    <p className="text-primary-700 dark:text-primary-300 text-sm ml-10">Student: {q.student_answer || '[blank]'}</p>
                    
                    <div className={`p-3 rounded-lg border ${
                      isCorrect ? 'bg-sage-50 border-sage-200 dark:bg-sage-900/30 dark:border-sage-800' : 'bg-warm-50 border-warm-200 dark:bg-warm-900/30 dark:border-warm-800'
                    }`}>
                      <p className={`text-sm ${isCorrect ? 'text-sage-700 dark:text-sage-300' : 'text-warm-700 dark:text-warm-300'}`}>
                        {q.feedback}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="border-2 border-dashed border-primary-200 dark:border-primary-800 rounded-xl p-8 text-center bg-primary-50/50 dark:bg-primary-900/20">
            <p className="text-primary-500 dark:text-primary-400">No questions were found in the submission.</p>
          </div>
        )}

        <button
          onClick={onReset}
          className="w-full mt-4 px-4 py-3 border-2 border-dashed border-primary-200 dark:border-primary-800 rounded-xl text-primary-600 dark:text-primary-400 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all font-medium"
        >
          <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Grade Another Homework
        </button>
      </div>
    </div>
  )
}