import React from 'react';

export default function BatchReviewGrid({
  results,
  onOverride,
  onExport
}) {
  const [editingIndex, setEditingIndex] = React.useState(null);
  const [editForm, setEditForm] = React.useState({});

  const handleEdit = (index, result) => {
    setEditingIndex(index);
    setEditForm({
      studentName: `Student ${index + 1}`,
      score: result.graded?.overall?.total_points_earned || 0,
      percentage: result.graded?.overall?.percentage || 0,
      letterGrade: result.graded?.overall?.letter_grade || 'F',
      standards: result.graded?.questions?.map(q => q.standard_code).filter(Boolean).join('; ') || '',
      feedback: result.graded?.overall?.summary_feedback || '',
      questions: result.graded?.questions?.map(q => ({
        questionNumber: q.question_number,
        isCorrect: q.is_correct,
        pointsEarned: q.points_earned,
        pointsPossible: q.points_possible,
        feedback: q.feedback,
        standardCode: q.standard_code
      })) || []
    });
  };

  const handleSave = (index, batchId) => {
    const overrides = {
      questions: editForm.questions.map((q, qi) => ({
        is_correct: q.isCorrect,
        points_earned: q.pointsEarned,
        points_possible: q.pointsPossible,
        feedback: q.feedback,
        standard_code: q.standardCode
      })),
      overall: {
        total_points_earned: editForm.score,
        percentage: editForm.percentage,
        letter_grade: editForm.letterGrade,
        summary_feedback: editForm.feedback
      }
    };
    
    onOverride(batchId, index, overrides);
    setEditingIndex(null);
    setEditForm({});
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditForm({});
  };

  const getStatusBadge = (result) => {
    if (result.error) {
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Failed</span>;
    }
    const pct = result.graded?.overall?.percentage || 0;
    if (pct >= 90) return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Excellent</span>;
    if (pct >= 70) return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Good</span>;
    if (pct >= 50) return <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Needs Work</span>;
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Struggling</span>;
  };

  if (!results || results.length === 0) {
    return (
      <div className="text-center py-12 text-primary-500 dark:text-primary-400">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>No results to review yet. Start a batch grading session.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary-900 dark:text-primary-100">
          Review & Override ({results.length} papers)
        </h3>
        {onExport && (
          <button
            onClick={onExport}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Export All CSV
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {results.map((result, index) => {
          const isEditing = editingIndex === index;
          const pct = result.graded?.overall?.percentage || 0;
          const letterGrade = result.graded?.overall?.letter_grade || 'F';
          const score = result.graded?.overall?.total_points_earned || 0;
          const total = result.graded?.overall?.total_points_possible || 0;

          if (isEditing) {
            return (
              <div key={index} className="col-span-full bg-white dark:bg-slate-800 rounded-xl border border-primary-200 dark:border-slate-600 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-primary-900 dark:text-primary-100">
                    Editing: {editForm.studentName} — {editForm.letterGrade} ({editForm.percentage}%)
                  </h4>
                  <button
                    onClick={handleCancel}
                    className="text-primary-500 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Score</label>
                    <input
                      type="number"
                      value={editForm.score}
                      onChange={e => setEditForm({...editForm, score: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-primary-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Percentage</label>
                    <input
                      type="number"
                      value={editForm.percentage}
                      onChange={e => setEditForm({...editForm, percentage: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-primary-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Letter Grade</label>
                    <select
                      value={editForm.letterGrade}
                      onChange={e => setEditForm({...editForm, letterGrade: e.target.value})}
                      className="w-full px-3 py-2 border border-primary-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100"
                    >
                      {['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Standards</label>
                    <input
                      type="text"
                      value={editForm.standards}
                      onChange={e => setEditForm({...editForm, standards: e.target.value})}
                      className="w-full px-3 py-2 border border-primary-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Feedback</label>
                  <textarea
                    value={editForm.feedback}
                    onChange={e => setEditForm({...editForm, feedback: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-primary-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100 resize-y"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
                    Questions ({editForm.questions.length})
                  </label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {editForm.questions.map((q, qi) => (
                      <div key={qi} className="p-3 bg-primary-50 dark:bg-slate-700/50 rounded-lg border border-primary-100 dark:border-slate-600">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2">
                          <div className="md:col-span-2">
                            <label className="block text-xs text-primary-500 dark:text-primary-400 mb-0.5">Question #{q.questionNumber}</label>
                            <input
                              type="text"
                              value={q.questionNumber}
                              onChange={e => {
                                const newQuestions = [...editForm.questions];
                                newQuestions[qi] = {...newQuestions[qi], questionNumber: e.target.value};
                                setEditForm({...editForm, questions: newQuestions});
                              }}
                              className="w-full px-2 py-1 border border-primary-200 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-primary-500 dark:text-primary-400 mb-0.5">Correct</label>
                            <select
                              value={q.isCorrect ? 'true' : 'false'}
                              onChange={e => {
                                const newQuestions = [...editForm.questions];
                                newQuestions[qi] = {...newQuestions[qi], isCorrect: e.target.value === 'true'};
                                setEditForm({...editForm, questions: newQuestions});
                              }}
                              className="w-full px-2 py-1 border border-primary-200 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100"
                            >
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-primary-500 dark:text-primary-400 mb-0.5">Pts / Total</label>
                            <div className="flex gap-1">
                              <input
                                type="number"
                                value={q.pointsEarned}
                                onChange={e => {
                                  const newQuestions = [...editForm.questions];
                                  newQuestions[qi] = {...newQuestions[qi], pointsEarned: Number(e.target.value)};
                                  setEditForm({...editForm, questions: newQuestions});
                                }}
                                className="w-1/2 px-2 py-1 border border-primary-200 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100"
                              />
                              <span className="flex items-center text-primary-500">/</span>
                              <input
                                type="number"
                                value={q.pointsPossible}
                                onChange={e => {
                                  const newQuestions = [...editForm.questions];
                                  newQuestions[qi] = {...newQuestions[qi], pointsPossible: Number(e.target.value)};
                                  setEditForm({...editForm, questions: newQuestions});
                                }}
                                className="w-1/2 px-2 py-1 border border-primary-200 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-primary-500 dark:text-primary-400 mb-0.5">Standard</label>
                            <input
                              type="text"
                              value={q.standardCode || ''}
                              onChange={e => {
                                const newQuestions = [...editForm.questions];
                                newQuestions[qi] = {...newQuestions[qi], standardCode: e.target.value};
                                setEditForm({...editForm, questions: newQuestions});
                              }}
                              className="w-full px-2 py-1 border border-primary-200 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100"
                              placeholder="e.g., 6.NS.A.1"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-primary-500 dark:text-primary-400 mb-0.5">Feedback</label>
                          <textarea
                            value={q.feedback}
                            onChange={e => {
                              const newQuestions = [...editForm.questions];
                              newQuestions[qi] = {...newQuestions[qi], feedback: e.target.value};
                              setEditForm({...editForm, questions: newQuestions});
                            }}
                            rows={2}
                            className="w-full px-2 py-1 border border-primary-200 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100 resize-y"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-primary-100 dark:border-slate-600">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-primary-100 dark:bg-slate-700 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSave(index, results[index]?.batch_id || '')}
                    className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={index} className="bg-white dark:bg-slate-800 rounded-xl border border-primary-100 dark:border-slate-600 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <span className="font-medium text-primary-900 dark:text-primary-100">
                  Student {index + 1}
                </span>
                {getStatusBadge(result)}
              </div>

              {result.error ? (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  <strong>Error:</strong> {result.error}
                  {result.details && <span className="block mt-1 text-xs opacity-75">{result.details}</span>}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="text-center p-2 bg-primary-50 dark:bg-slate-700/50 rounded-lg">
                      <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{pct}%</div>
                      <div className="text-xs text-primary-500 dark:text-primary-400">Percentage</div>
                    </div>
                    <div className="text-center p-2 bg-primary-50 dark:bg-slate-700/50 rounded-lg">
                      <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{letterGrade}</div>
                      <div className="text-xs text-primary-500 dark:text-primary-400">Letter Grade</div>
                    </div>
                    <div className="text-center p-2 bg-primary-50 dark:bg-slate-700/50 rounded-lg">
                      <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{score}/{total}</div>
                      <div className="text-xs text-primary-500 dark:text-primary-400">Points</div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="block text-xs text-primary-500 dark:text-primary-400 mb-1">Standards</label>
                    <div className="text-sm text-primary-700 dark:text-primary-300 font-mono truncate">
                      {result.graded?.questions?.map(q => q.standard_code).filter(Boolean).join(', ') || '—'}
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="block text-xs text-primary-500 dark:text-primary-400 mb-1">Feedback</label>
                    <div className="text-sm text-primary-700 dark:text-primary-300 line-clamp-2">
                      {result.graded?.overall?.summary_feedback || 'No feedback provided'}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-primary-100 dark:border-slate-600">
                    <span className="text-xs text-primary-500 dark:text-primary-400">
                      {result.graded?.questions?.length || 0} questions graded
                    </span>
                    <button
                      onClick={() => handleEdit(index, result)}
                      className="px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                    >
                      Override
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {results.length > 0 && onExport && (
        <div className="mt-6 text-center">
          <button
            onClick={onExport}
            className="px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors font-medium flex items-center justify-center gap-2 mx-auto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Export All Results to CSV
          </button>
        </div>
      )}
    </div>
  );
}