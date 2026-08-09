/**
 * Classroom Grading Modal - Grades a submission and pushes to Classroom
 */

import { useState, useEffect } from 'react';
import { extractHandwriting, gradeSubmission } from '../lib/gradeHomework';
import { useGradePush } from '../hooks/useClassroom';

export default function ClassroomGradingModal({ submission, onClose, onGraded }) {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [gradingResult, setGradingResult] = useState(null);
  const [error, setError] = useState(null);
  const [gradeLevel, setGradeLevel] = useState('5');
  const [subject, setSubject] = useState('Math');
  const [useCustomRubric, setUseCustomRubric] = useState(false);
  const [customRubricImage, setCustomRubricImage] = useState(null);
  const [customRubricPreview, setCustomRubricPreview] = useState(null);
  const [extractedCustomRubric, setExtractedCustomRubric] = useState(null);
  const { pushGrade, loading: pushLoading, error: pushError } = useGradePush();

  // Fetch submission attachment image if available
  useEffect(() => {
    if (submission?.attachments?.[0]?.driveFile?.id) {
      // In a real implementation, you'd fetch the file from Google Drive
      // For now, we'll show a placeholder
    }
  }, [submission]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setImage(file);
      const reader = new FileReader();
      reader.onload = (event) => setImagePreview(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleCustomRubricImageChange = async (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setCustomRubricImage(file);
      const reader = new FileReader();
      reader.onload = (event) => setCustomRubricPreview(event.target.result);
      reader.readAsDataURL(file);
      setExtractedCustomRubric(null);
    }
  };

  const handleGradeClick = async () => {
    if (!image) return;
    if (useCustomRubric && !customRubricImage && !extractedCustomRubric) return;

    setIsLoading(true);
    setError(null);
    setGradingResult(null);

    try {
      const extractedQuestions = await extractHandwriting(image, gradeLevel, subject);

      let finalRubric = null;
      if (useCustomRubric) {
        if (extractedCustomRubric) {
          finalRubric = JSON.stringify(extractedCustomRubric, null, 2);
        } else if (customRubricImage) {
          const customRubricData = await extractCustomRubric(customRubricImage);
          setExtractedCustomRubric(customRubricData);
          finalRubric = JSON.stringify(customRubricData, null, 2);
        }
      }

      const result = await gradeSubmission(extractedQuestions, finalRubric, gradeLevel, subject);
      setGradingResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePushToClassroom = async () => {
    if (!gradingResult) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await pushGrade(submission.id, gradingResult);
      if (result?.success) {
        onGraded?.(submission.id, result);
        onClose?.();
      } else {
        setError(result?.error || 'Failed to push grade to Classroom');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!submission) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-primary-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800 z-10 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Grade & Push to Classroom</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{submission.student_name || 'Student'} • {submission.gc_submission_id}</p>
          </div>
          <button onClick={onClose} disabled={isLoading} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-2xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-6">
          {/* Student Info */}
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 dark:text-slate-400">Student</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{submission.student_name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Email</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{submission.student_email || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">State</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{submission.state}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Current Grade</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{submission.assigned_grade !== null ? `${submission.assigned_grade} pts` : 'Not graded'}</p>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {(error || pushError) && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error || pushError}
            </div>
          )}

          {/* Grading Form */}
          {!gradingResult && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Student Work Image</label>
                <div className="border-2 border-dashed border-primary-200 dark:border-slate-700 rounded-xl p-6 text-center hover:border-primary-400 dark:hover:border-primary-500 transition-colors">
                  {imagePreview ? (
                    <div className="relative max-h-64">
                      <img src={imagePreview} alt="Student work" className="max-h-64 mx-auto rounded-lg shadow" />
                      <button onClick={() => { setImage(null); setImagePreview(null); }} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">×</button>
                    </div>
                  ) : (
                    <div>
                      <svg className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-slate-500 dark:text-slate-400 mb-2">Upload student work image</p>
                      <input type="file" accept="image/*" onChange={handleImageChange} className="sr-only" id="classroom-work-image" />
                      <label htmlFor="classroom-work-image" className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg cursor-pointer inline-block">Choose File</label>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Or drag and drop</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Grade Level</label>
                  <select value={gradeLevel} onChange={e => setGradeLevel(e.target.value)} className="w-full px-3 py-2 border border-primary-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                    <option value="K">Kindergarten</option>
                    <option value="1">1st Grade</option>
                    <option value="2">2nd Grade</option>
                    <option value="3">3rd Grade</option>
                    <option value="4">4th Grade</option>
                    <option value="5">5th Grade</option>
                    <option value="6">6th Grade</option>
                    <option value="7">7th Grade</option>
                    <option value="8">8th Grade</option>
                    <option value="9">9th Grade</option>
                    <option value="10">10th Grade</option>
                    <option value="11">11th Grade</option>
                    <option value="12">12th Grade</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Subject</label>
                  <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full px-3 py-2 border border-primary-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                    <option value="Math">Math</option>
                    <option value="English">English</option>
                    <option value="Science">Science</option>
                    <option value="History">History</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="useCustomRubric" checked={useCustomRubric} onChange={e => setUseCustomRubric(e.target.checked)} className="w-4 h-4 text-primary-500 border-primary-200 dark:border-slate-700 rounded focus:ring-primary-500" />
                <label htmlFor="useCustomRubric" className="text-sm text-slate-700 dark:text-slate-300">Use custom rubric (upload rubric image)</label>
              </div>

              {useCustomRubric && (
                <div className="border border-primary-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Rubric Image</label>
                  <div className="border-2 border-dashed border-primary-200 dark:border-slate-700 rounded-lg p-6 text-center">
                    {customRubricPreview ? (
                      <div className="relative max-h-48">
                        <img src={customRubricPreview} alt="Custom rubric" className="max-h-48 mx-auto rounded-lg shadow" />
                        <button onClick={() => { setCustomRubricImage(null); setCustomRubricPreview(null); setExtractedCustomRubric(null); }} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">×</button>
                      </div>
                    ) : (
                      <div>
                        <input type="file" accept="image/*" onChange={handleCustomRubricImageChange} className="sr-only" id="custom-rubric-image" />
                        <label htmlFor="custom-rubric-image" className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg cursor-pointer inline-block">Upload Rubric Image</label>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleGradeClick}
                disabled={isLoading || !image || (useCustomRubric && !customRubricImage && !extractedCustomRubric)}
                className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Grading with AI...
                  </>
                ) : (
                  'Grade with HomeworkHelper AI'
                )}
              </button>
            </div>
          )}

          {/* Grading Result */}
          {gradingResult && (
            <div className="space-y-4 border-t border-primary-200 dark:border-slate-700 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Grading Result</h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${gradingResult.overall?.letter_grade?.startsWith('A') ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : gradingResult.overall?.letter_grade?.startsWith('B') ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'}`}>
                  {gradingResult.overall?.letter_grade || 'N/A'}
                </span>
              </div>

              <div className="text-sm text-slate-500 dark:text-slate-400">
                {gradingResult.overall?.total_points_earned}/{gradingResult.overall?.total_points_possible} points • {gradingResult.overall?.encouragement_message}
              </div>

              {gradingResult.questions && gradingResult.questions.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {gradingResult.questions.map((q, i) => (
                    <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900 dark:text-slate-100">Q{i + 1}: {q.question_text}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Student: {q.student_answer}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Correct: {q.correct_answer}</p>
                          {q.feedback && <p className="text-sm text-primary-600 dark:text-primary-400 mt-1">{q.feedback}</p>}
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${q.is_correct ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                          {q.is_correct ? '✓' : '✗'} {q.points_earned}/{q.points_possible}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setGradingResult(null)}
                  className="flex-1 py-2 px-4 border border-primary-200 dark:border-slate-700 text-primary-600 dark:text-primary-400 font-medium rounded-lg hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Re-grade
                </button>
                <button
                  onClick={handlePushToClassroom}
                  disabled={pushLoading || isLoading}
                  className="flex-1 py-2 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {pushLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Pushing to Classroom...
                    </>
                  ) : (
                    'Push Grade to Classroom'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}