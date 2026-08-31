import './PrintableReport.css'

export default function PrintableReport({ gradingResult, studentName = '', assignmentTitle = '', date = new Date().toLocaleDateString() }) {
  const { questions = [], overall = {} } = gradingResult
  const { 
    total_points_earned = 0, 
    total_points_possible = 0, 
    letter_grade = 'N/A', 
    encouragement_message = '',
    standards_mastery = {}
  } = overall
  const percentage = total_points_possible > 0 ? Math.round((total_points_earned / total_points_possible) * 100) : 0
  const wrongCount = questions.filter(q => q.is_correct === false).length

  // Calculate standards mastery for display
  const standardsEntries = Object.entries(standards_mastery).map(([standard, data]) => ({
    standard,
    mastery: data.mastery_percentage || data.mastery || 0,
    questions: data.questions || []
  }))

  return (
    <div className="printable-report">
      <div className="print-btn no-print">
        <button 
          onClick={() => window.print()}
          className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl shadow-lg flex items-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2h2" />
          </svg>
          Print Report
        </button>
      </div>

      <div className="report-page">
        {/* Header */}
        <header className="report-header">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
            <div>
              <h1 className="report-title">HomeworkHelper — Grading Summary</h1>
              <p className="report-subtitle">AI-Powered Standards-Aligned Feedback</p>
            </div>
            <div style={{textAlign: 'right', fontSize: '13px', color: '#64748b'}}>
              <p>Generated: {date}</p>
              <p>HomeworkHelper · letsmakeai.fun</p>
            </div>
          </div>
        </header>

        {/* Meta Info Grid */}
        <div className="meta-grid">
          <div className="meta-item">
            <div className="meta-label">Student</div>
            <div className="meta-value">{studentName || '__________________'}</div>
          </div>
          <div className="meta-item">
            <div className="meta-label">Assignment</div>
            <div className="meta-value">{assignmentTitle || '__________________'}</div>
          </div>
          <div className="meta-item">
            <div className="meta-label">Date</div>
            <div className="meta-value">{date}</div>
          </div>
          <div className="meta-item">
            <div className="meta-label">Questions</div>
            <div className="meta-value">{questions.length} total · {wrongCount} to review</div>
          </div>
        </div>

        {/* Overall Grade Card */}
        <div className="overall-grade">
          <div className="grade-circle">
            <span className="grade-letter">{letter_grade}</span>
          </div>
          <div className="grade-details">
            <div className="grade-percentage">{percentage}%</div>
            <div className="grade-points">{total_points_earned} / {total_points_possible} points earned</div>
            {encouragement_message && <div className="grade-encouragement">"{encouragement_message}"</div>}
          </div>
        </div>

        {/* Per-Question Breakdown */}
        <section className="questions-section">
          <h3>Per-Question Feedback</h3>
          {questions.length > 0 ? (
            questions.map((q, idx) => {
              const isCorrect = q.is_correct === true
              return (
                <div key={q.question_number} className={`question-card ${isCorrect ? 'correct' : 'incorrect'}`}>
                  <div className="question-header">
                    <span className="question-number">Question {q.question_number}</span>
                    <div className={`question-status ${isCorrect ? 'correct' : 'incorrect'}`}>
                      {isCorrect ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <span className={`question-points ${isCorrect ? 'correct' : 'incorrect'}`}>
                      {q.points_earned}/{q.points_possible} pts
                    </span>
                    {q.standard && (
                      <span style={{fontSize: '11px', color: '#0f766e', background: '#ccfbf1', padding: '2px 8px', borderRadius: '9999px', fontFamily: 'monospace', marginLeft: 'auto'}}>
                        {q.standard}
                      </span>
                    )}
                  </div>

                  <p className="student-answer">Student Answer: {q.student_answer || '[blank]'}</p>

                  <div className={`feedback-box ${isCorrect ? 'correct' : 'incorrect'}`}>
                    {q.feedback}
                  </div>
                </div>
              )
            })
          ) : (
            <p style={{textAlign: 'center', color: '#64748b', padding: '24px'}}>No questions found in submission.</p>
          )}
        </section>

        {/* Standards Mastery */}
        {standardsEntries.length > 0 && (
          <section className="standards-section">
            <h3>Standards Mastery</h3>
            <div className="standards-grid">
              {standardsEntries.map(({standard, mastery}) => (
                <div key={standard} className="standard-card">
                  <div className="standard-code">{standard}</div>
                  <div className="standard-bar">
                    <div className="standard-fill" style={{width: `${Math.round(mastery)}%`}}></div>
                  </div>
                  <div className="standard-percentage">{Math.round(mastery)}% mastered</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Signature Lines */}
        <div className="signature-section">
          <div>
            <div className="signature-line"></div>
            <div className="signature-label">Teacher Signature</div>
          </div>
          <div>
            <div className="signature-line"></div>
            <div className="signature-label">Date</div>
          </div>
        </div>

        <p className="footer-note">
          This report was generated by HomeworkHelper AI Grading. 
          Review all feedback before returning to student. 
          {studentName ? `Prepared for ${studentName}.` : ''}
        </p>
      </div>
    </div>
  )
}