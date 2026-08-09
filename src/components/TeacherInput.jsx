import React from 'react'

const SUBJECTS = ['Math', 'Reading', 'Writing', 'Science', 'Other']

export default function TeacherInput({
  image,
  imagePreview,
  rubric,
  gradeLevel,
  subject,
  isLoading,
  onImageChange,
  onRubricChange,
  onSubjectChange,
  onGradeClick,
  onRemoveImage,
  onOpenSettings,
  useCustomRubric,
  setUseCustomRubric,
  customRubricImage,
  customRubricPreview,
  onCustomRubricImageChange,
  onRemoveCustomRubric,
  savedRubrics,
  onSaveRubric,
  onSelectSavedRubric,
  onClearCustomRubric,
  isExtractingRubric
}) {
  const fileInputRef = React.useRef(null)
  const customRubricFileInputRef = React.useRef(null)
  const dragActive = React.useRef(false)
  const customDragActive = React.useRef(false)

  const handleDrag = (e, isCustom = false) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      if (isCustom) customDragActive.current = true
      else dragActive.current = true
    } else if (e.type === 'dragleave') {
      if (isCustom) customDragActive.current = false
      else dragActive.current = false
    }
  }

  const handleDrop = (e, isCustom = false) => {
    e.preventDefault()
    e.stopPropagation()
    if (isCustom) customDragActive.current = false
    else dragActive.current = false
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.type.startsWith('image/')) {
        if (isCustom) {
          onCustomRubricImageChange({ target: { files: [file] } })
        } else {
          onImageChange({ target: { files: [file] } })
        }
      }
    }
  }

  const handleClickUpload = () => fileInputRef.current?.click()
  const handleCustomClickUpload = () => customRubricFileInputRef.current?.click()

  const isReady = image && (!useCustomRubric || customRubricImage || extractedCustomRubric)

  // Format grade level for display
  const formatGradeLevel = (level) => {
    if (level === 'K') return 'Kindergarten'
    return level + ' Grade'
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-primary-100 dark:border-slate-700 transition-colors duration-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-primary-900 dark:text-primary-100 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Teacher Input
        </h2>
        <button
          onClick={onOpenSettings}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-slate-700 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-slate-600 transition-colors cursor-pointer flex items-center gap-1"
          aria-label="Change grade level"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {formatGradeLevel(gradeLevel)}
        </button>
      </div>

      {/* Homework Image Upload Dropzone */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">Homework Image</label>
        <div
          ref={fileInputRef}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
            dragActive.current
              ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
              : image
              ? 'border-sage-300 bg-sage-50 dark:bg-sage-900/20'
              : 'border-primary-200 hover:border-primary-300 dark:border-slate-600 dark:hover:border-slate-500'
          }`}
          onDragEnter={(e) => handleDrag(e, false)}
          onDragLeave={(e) => handleDrag(e, false)}
          onDragOver={(e) => handleDrag(e, false)}
          onDrop={(e) => handleDrop(e, false)}
          onClick={handleClickUpload}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept="image/jpeg,image/png,image/webp"
            onChange={onImageChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
            disabled={isLoading}
          />

          {imagePreview ? (
            <div className="relative max-w-full mx-auto">
              <img
                src={imagePreview}
                alt="Uploaded homework"
                className="max-h-64 rounded-lg shadow-md mx-auto"
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemoveImage() }}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-700 text-primary-600 dark:text-primary-400 flex items-center justify-center shadow-lg transition-colors"
                aria-label="Remove image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <svg className="w-12 h-12 mx-auto text-primary-300 dark:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <div>
                <p className="text-primary-600 dark:text-primary-400 font-medium">Drag & drop an image here</p>
                <p className="text-primary-400 dark:text-primary-500 text-sm">or click to browse</p>
              </div>
              <p className="text-xs text-primary-300 dark:text-primary-600">JPG, PNG, WebP · Max 10MB</p>
            </div>
          )}
        </div>
      </div>

      {/* Custom Rubric Toggle */}
      <div className="mb-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={useCustomRubric}
            onChange={(e) => setUseCustomRubric(e.target.checked)}
            className="w-4 h-4 text-primary-600 border-primary-300 rounded focus:ring-primary-500 focus:ring-2"
            disabled={isLoading}
          />
          <span className="text-primary-700 dark:text-primary-300 font-medium">Use my own answer key instead</span>
        </label>
        <p className="text-xs text-primary-500 dark:text-primary-400 mt-1 ml-7">
          Skip Illinois standards auto-rubric. Upload your own answer key image for OCR transcription.
        </p>
      </div>

      {/* Custom Rubric Image Upload (conditional) */}
      {useCustomRubric && (
        <div className="mb-6 p-4 border border-primary-200 dark:border-slate-600 rounded-xl bg-primary-50 dark:bg-primary-900/20">
          <div className="mb-3">
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">Upload Your Answer Key</label>
            <div
              ref={customRubricFileInputRef}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 ${
                customDragActive.current
                  ? 'border-primary-400 bg-primary-100 dark:bg-primary-900/30'
                  : customRubricImage
                  ? 'border-sage-300 bg-sage-50 dark:bg-sage-900/20'
                  : 'border-primary-200 hover:border-primary-300 dark:border-slate-600 dark:hover:border-slate-500'
              }`}
              onDragEnter={(e) => handleDrag(e, true)}
              onDragLeave={(e) => handleDrag(e, true)}
              onDragOver={(e) => handleDrag(e, true)}
              onDrop={(e) => handleDrop(e, true)}
              onClick={handleCustomClickUpload}
            >
              <input
                type="file"
                ref={customRubricFileInputRef}
                accept="image/jpeg,image/png,image/webp"
                onChange={onCustomRubricImageChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={isLoading || isExtractingRubric}
              />

              {customRubricPreview ? (
                <div className="relative max-w-full mx-auto">
                  <img
                    src={customRubricPreview}
                    alt="Uploaded answer key"
                    className="max-h-48 rounded-lg shadow-md mx-auto"
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemoveCustomRubric() }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-700 text-primary-600 dark:text-primary-400 flex items-center justify-center shadow-lg transition-colors"
                    aria-label="Remove answer key"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
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

          {/* Saved Rubrics Dropdown */}
          {savedRubrics.length > 0 && (
            <div className="mt-4 pt-4 border-t border-primary-200 dark:border-slate-600">
              <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
                Or select a saved rubric
              </label>
              <select
                value=""
                onChange={(e) => { if (e.target.value) onSelectSavedRubric(e.target.value) }}
                className="w-full px-4 py-3 border border-primary-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100 appearance-none transition-colors"
              >
                <option value="" disabled>Choose a saved rubric...</option>
                {savedRubrics.map((rubric) => (
                  <option key={rubric.id} value={rubric.id}>
                    {rubric.name} ({rubric.subject} · {rubric.gradeLevel})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Save Rubric Button (shown after OCR) */}
          {customRubricImage && !isExtractingRubric && (
            <button
              type="button"
              onClick={onSaveRubric}
              className="mt-4 w-full px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
              disabled={isExtractingRubric}
            >
              Save This Rubric for Reuse
            </button>
          )}
        </div>
      )}

      {/* Answer Key / Rubric (shown when NOT using custom rubric) — OPTIONAL override */}
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
            className="w-full px-4 py-3 border border-primary-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100 resize-y transition-all"
            placeholder={"Optional: paste your own answer key / grading notes to override the auto-generated rubric...\n\nExample:\nQ1: 42 (2 pts)\nQ2: 8 (3 pts, partial credit for showing work)\nQ3: Essay - check for thesis, evidence, conclusion"}
            disabled={isLoading}
          />
        </div>
      )}

      {/* Subject Dropdown */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">Subject</label>
        <select
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          className="w-full px-4 py-3 border border-primary-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100 appearance-none transition-colors"
          disabled={isLoading}
        >
          {SUBJECTS.map((subj) => (
            <option key={subj} value={subj}>{subj}</option>
          ))}
        </select>
      </div>

      {/* Grade Button */}
      <button
        onClick={onGradeClick}
        disabled={!isReady || isLoading || isExtractingRubric}
        className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-3 ${
          isReady && !isLoading && !isExtractingRubric
            ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 shadow-lg hover:shadow-xl'
            : 'bg-primary-100 dark:bg-slate-700 text-primary-300 dark:text-primary-600 cursor-not-allowed'
        }`}
      >
        {isExtractingRubric ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Extracting rubric from image...
          </>
        ) : isLoading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Grading...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Grade This Homework
          </>
        )}
      </button>

      {!isReady && !isLoading && !isExtractingRubric && (
        <p className="text-center text-sm text-primary-400 dark:text-primary-500 mt-3">
          {useCustomRubric
            ? customRubricImage
              ? 'Click "Grade This Homework" to proceed'
              : 'Upload your answer key image to enable grading'
            : image
            ? 'Ready — auto-grade from IBSE standards (or paste an answer key to override)'
            : 'Upload an image to get started'}
        </p>
      )}
    </div>
  )
}