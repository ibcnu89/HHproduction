import React from 'react';

const SUBJECTS = ['Math', 'Reading', 'Writing', 'Science', 'Social Studies', 'English', 'History', 'Other'];

export default function BatchConfigPanel({
  gradeLevel,
  subject,
  rubric,
  standardsText,
  onGradeLevelChange,
  onSubjectChange,
  onRubricChange,
  onStandardsTextChange,
  useCustomRubric,
  onUseCustomRubricChange,
  customRubricImage,
  onCustomRubricImageChange,
  isExtractingRubric,
  onClearCustomRubric,
  isLoading
}) {
  const handleGradeLevelChange = (e) => onGradeLevelChange(e.target.value);
  const handleSubjectChange = (e) => onSubjectChange(e.target.value);

  return (
    <div className="space-y-6">
      {/* Grade Level & Subject Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
            Grade Level
          </label>
          <select
            value={gradeLevel}
            onChange={handleGradeLevelChange}
            disabled={isLoading}
            className="w-full px-4 py-3 border border-primary-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100 transition-colors"
          >
            <option value="K">Kindergarten</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(grade => (
              <option key={grade} value={grade}>{grade} Grade</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
            Subject
          </label>
          <select
            value={subject}
            onChange={handleSubjectChange}
            disabled={isLoading}
            className="w-full px-4 py-3 border border-primary-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100 transition-colors"
          >
            {SUBJECTS.map(subj => (
              <option key={subj} value={subj}>{subj}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Custom Rubric Toggle */}
      <div className="mb-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={useCustomRubric}
            onChange={(e) => onUseCustomRubricChange(e.target.checked)}
            disabled={isLoading}
            className="w-4 h-4 text-primary-600 border-primary-300 rounded focus:ring-primary-500 focus:ring-2"
          />
          <span className="text-primary-700 dark:text-primary-300 font-medium">
            Use my own answer key instead of auto-generated rubric
          </span>
        </label>
        <p className="text-xs text-primary-500 dark:text-primary-400 mt-1 ml-7">
          Skip Illinois standards auto-rubric. Upload your answer key image for OCR transcription.
        </p>
      </div>

      {/* Custom Rubric Image Upload */}
      {useCustomRubric && (
        <div className="mb-6 p-4 border border-primary-200 dark:border-slate-600 rounded-xl bg-primary-50 dark:bg-primary-900/20">
          <div className="mb-3">
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
              Upload Your Answer Key
            </label>
            <div
              className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 ${
                customRubricImage
                  ? 'border-sage-300 bg-sage-50 dark:bg-sage-900/20'
                  : 'border-primary-200 hover:border-primary-300 dark:border-slate-600 dark:hover:border-slate-500'
              }`}
              onClick={() => document.getElementById('custom-rubric-input')?.click()}
            >
              <input
                id="custom-rubric-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onCustomRubricImageChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={isLoading || isExtractingRubric}
              />

              {customRubricImage ? (
                <div className="relative max-w-full mx-auto">
                  <img
                    src={customRubricImage}
                    alt="Uploaded answer key"
                    className="max-h-48 rounded-lg shadow-md mx-auto"
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onClearCustomRubric(); }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center justify-center shadow-lg"
                    aria-label="Remove answer key"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <svg className="w-10 h-10 mx-auto text-primary-300 dark:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p className="text-primary-600 dark:text-primary-400 font-medium">Drag & drop your answer key here</p>
                    <p className="text-primary-400 dark:text-primary-500 text-sm">or click to browse</p>
                  </div>
                  <p className="text-xs text-primary-300 dark:text-primary-600">JPG, PNG, WebP · Max 10MB</p>
                </div>
              )}
            </div>
          </div>

          {isExtractingRubric && (
            <div className="flex items-center gap-3 text-primary-600 dark:text-primary-400">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Extracting rubric from image...</span>
            </div>
          )}

          {!isExtractingRubric && customRubricImage && (
            <button
              type="button"
              onClick={onClearCustomRubric}
              className="mt-3 w-full px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
              disabled={isLoading}
            >
              Save This Rubric for Reuse
            </button>
          )}
        </div>
      )}

      {/* Manual Rubric / Standards Override */}
      {!useCustomRubric && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-300">
              Answer Key / Rubric <span className="text-xs font-normal text-primary-400 dark:text-primary-500">(optional)</span>
            </label>
            <span className="text-xs text-primary-400 dark:text-primary-500">Auto-generated from IBSE standards by default</span>
          </div>
          <textarea
            value={rubric}
            onChange={(e) => onRubricChange(e.target.value)}
            rows={6}
            disabled={isLoading}
            className="w-full px-4 py-3 border border-primary-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100 resize-y transition-all"
            placeholder="Optional: paste your own answer key / grading notes to override the auto-generated rubric...&#10;&#10;Example:&#10;Q1: 42 (2 pts)&#10;Q2: 8 (3 pts, partial credit for showing work)&#10;Q3: Essay - check for thesis, evidence, conclusion"
          />
        </div>
      )}

      {/* Standards Text (read-only, for reference) */}
      {standardsText && (
        <details className="mb-6">
          <summary className="text-sm text-primary-500 dark:text-primary-400 cursor-pointer hover:underline">
            View Illinois Learning Standards being used
          </summary>
          <pre className="mt-2 p-3 bg-primary-50 dark:bg-slate-800 rounded-lg text-xs text-primary-700 dark:text-primary-300 overflow-x-auto max-h-48 overflow-y-auto">
            {standardsText}
          </pre>
        </details>
      )}
    </div>
  );
}