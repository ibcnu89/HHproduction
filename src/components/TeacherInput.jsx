import React from 'react'

export default function TeacherInput({
  image,
  imagePreview,
  _rubric,
  gradeLevel,
  _subject,
  isLoading,
  onImageChange,
  _onRubricChange,
  _onSubjectChange,
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
  isExtractingRubric
}) {
  const fileInputRef = React.useRef(null)
  const customRubricFileInputRef = React.useRef(null)
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [isCustomDragOver, setIsCustomDragOver] = React.useState(false)

  const handleDrag = (e, isCustom = false) => {
    e.preventDefault()
    e.stopPropagation()
    if (isCustom) setIsCustomDragOver(e.type === 'dragenter' || e.type === 'dragover')
    else setIsDragOver(e.type === 'dragenter' || e.type === 'dragover')
  }

  const handleDrop = (e, isCustom = false) => {
    e.preventDefault()
    e.stopPropagation()
    if (isCustom) setIsCustomDragOver(false)
    else setIsDragOver(false)
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

  const imageReady = !!image
  const customReady = !useCustomRubric || !!customRubricImage
  const isReady = imageReady && customReady

  const SUBJECTS = ['Math', 'Reading', 'Writing', 'Science', 'Other']

  return (
    <div className="bg-surface dark:bg-ink-card rounded-2xl border border-subtle dark:border-ink-700 shadow-soft overflow-hidden transition-colors duration-200">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-subtle dark:border-ink-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold-subtle dark:bg-gold-900/20 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-display-sm text-ink font-bold">Teacher Input</h2>
              <p className="text-caption text-ink-muted">Upload student work to grade</p>
            </div>
          </div>
          {/* Grade level badge */}
          <button
            onClick={onOpenSettings}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-caption text-ink-muted hover:text-ink dark:hover:text-ink-50 bg-surface-muted dark:bg-ink-800 hover:bg-ink-100 dark:hover:bg-ink-700 transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Grade {gradeLevel}{gradeLevel === 'K' ? '' : gradeLevel.endsWith('st') || gradeLevel.endsWith('nd') || gradeLevel.endsWith('rd') || gradeLevel === 'th' ? '' : gradeLevel === '1' || gradeLevel === '2' || gradeLevel === '3' ? '' : 'th'} · {_subject}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* ─── Homework Image Upload Dropzone ─── */}
        <div>
          <label className="block text-body-sm font-medium text-ink mb-2.5">
            Homework Image
          </label>
          <div
            ref={fileInputRef}
            onClick={handleClickUpload}
            onDragEnter={(e) => handleDrag(e, false)}
            onDragLeave={(e) => handleDrag(e, false)}
            onDragOver={(e) => handleDrag(e, false)}
            onDrop={(e) => handleDrop(e, false)}
            className={`relative rounded-xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-250 select-none ${
              isDragOver
                ? 'dropzone-active scale-[1.01]'
                : image
                ? 'dropzone-has-file'
                : 'dropzone-default'
            }`}
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
              <div className="relative max-w-md mx-auto animate-scale-in">
                <div className="relative rounded-xl overflow-hidden shadow-soft">
                  <img
                    src={imagePreview}
                    alt="Uploaded homework"
                    className="max-h-64 w-full object-contain bg-ink-50 dark:bg-ink-800"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemoveImage() }}
                  className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white dark:bg-ink-800 border border-subtle dark:border-ink-600 text-ink-muted hover:text-rose-500 shadow-soft flex items-center justify-center transition-all duration-200 hover:scale-110"
                  aria-label="Remove image"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <p className="text-caption text-sage mt-2">
                  Image ready
                </p>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300 ${
                  isDragOver
                    ? 'bg-gold-100 dark:bg-gold-900/30 scale-110'
                    : 'bg-ink-100 dark:bg-ink-800'
                }`}>
                  <svg
                    className={`w-6 h-6 transition-colors duration-300 ${
                      isDragOver ? 'text-gold-500' : 'text-ink-400'
                    }`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-body text-ink font-medium">
                    {isDragOver ? 'Drop to upload' : 'Drag & drop an image'}
                  </p>
                  <p className="text-body-sm text-ink-muted mt-0.5">or click to browse files</p>
                </div>
                <div className="flex items-center justify-center gap-3 text-caption text-ink-subtle">
                  <span>JPG</span>
                  <span className="w-1 h-1 rounded-full bg-ink-300 dark:bg-ink-600" />
                  <span>PNG</span>
                  <span className="w-1 h-1 rounded-full bg-ink-300 dark:bg-ink-600" />
                  <span>WebP</span>
                  <span className="w-1 h-1 rounded-full bg-ink-300 dark:bg-ink-600" />
                  <span>Max 10MB</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Custom Rubric Toggle ─── */}
        <div className="bg-surface-muted dark:bg-ink-800 rounded-xl p-4">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                checked={useCustomRubric}
                onChange={(e) => setUseCustomRubric(e.target.checked)}
                className="sr-only peer"
                disabled={isLoading}
              />
              <div className={`w-10 h-6 rounded-full transition-all duration-200 ${
                useCustomRubric ? 'bg-gold-500' : 'bg-ink-300 dark:bg-ink-600'
              }`} />
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-soft transition-all duration-200 ${
                useCustomRubric ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-body-sm font-medium text-ink">Use my own answer key</span>
              <p className="text-caption text-ink-muted mt-0.5">
                Skip auto-rubric and upload your answer key instead
              </p>
            </div>
          </label>
        </div>

        {/* ─── Custom Rubric Upload (conditional) ─── */}
        {useCustomRubric && (
          <div className="animate-slide-down">
            <label className="block text-body-sm font-medium text-ink mb-2.5">
              Upload Answer Key
            </label>
            <div
              ref={customRubricFileInputRef}
              onClick={handleCustomClickUpload}
              onDragEnter={(e) => handleDrag(e, true)}
              onDragLeave={(e) => handleDrag(e, true)}
              onDragOver={(e) => handleDrag(e, true)}
              onDrop={(e) => handleDrop(e, true)}
              className={`relative rounded-xl p-6 text-center cursor-pointer transition-all duration-250 select-none ${
                isCustomDragOver
                  ? 'dropzone-active scale-[1.01]'
                  : customRubricImage
                  ? 'dropzone-has-file'
                  : 'dropzone-default'
              }`}
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
                <div className="relative max-w-xs mx-auto animate-scale-in">
                  <div className="relative rounded-lg overflow-hidden shadow-soft">
                    <img
                      src={customRubricPreview}
                      alt="Uploaded answer key"
                      className="max-h-36 w-full object-contain bg-ink-50 dark:bg-ink-800"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemoveCustomRubric() }}
                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white dark:bg-ink-800 border border-subtle dark:border-ink-600 text-ink-muted hover:text-rose-500 shadow-soft flex items-center justify-center transition-all duration-200 hover:scale-110"
                    aria-label="Remove answer key"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <p className="text-caption text-sage mt-2">Answer key ready</p>
                </div>
              ) : (
                <div className="space-y-3 animate-fade-in">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${
                    isCustomDragOver ? 'bg-gold-100 dark:bg-gold-900/30 scale-110' : 'bg-ink-100 dark:bg-ink-800'
                  }`}>
                    <svg className={`w-5.5 h-5.5 transition-colors duration-300 ${isCustomDragOver ? 'text-gold-500' : 'text-ink-400'}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-body-sm text-ink font-medium">
                      {isCustomDragOver ? 'Drop to upload' : 'Drag & drop your answer key'}
                    </p>
                    <p className="text-caption text-ink-muted mt-0.5">or click to browse</p>
                  </div>
                </div>
              )}
            </div>

            {/* Saved Rubrics */}
            {savedRubrics.length > 0 && (
              <div className="mt-5 pt-5 border-t border-subtle dark:border-ink-700">
                <label className="block text-body-sm font-medium text-ink mb-2">
                  Or select a saved rubric
                </label>
                <select
                  value=""
                  onChange={(e) => { if (e.target.value) onSelectSavedRubric(e.target.value) }}
                  className="input-select"
                >
                  <option value="" disabled>Choose a saved rubric…</option>
                  {savedRubrics.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.subject} · {r.gradeLevel})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Save Rubric Button */}
            {customRubricImage && !isExtractingRubric && (
              <button
                type="button"
                onClick={onSaveRubric}
                className="mt-4 w-full px-4 py-2.5 rounded-xl bg-gold-50 dark:bg-gold-900/20 text-gold-700 dark:text-gold-300 hover:bg-gold-100 dark:hover:bg-gold-900/30 transition-all duration-200 text-body-sm font-semibold border border-gold-soft dark:border-gold-800/30"
                disabled={isExtractingRubric}
              >
                Save This Rubric for Reuse
              </button>
            )}
          </div>
        )}

        {/* ─── Answer Key / Rubric Text Area ─── */}
        {!useCustomRubric && (
          <div className="animate-slide-down">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-body-sm font-medium text-ink">
                Answer Key / Rubric <span className="font-normal text-ink-subtle">(optional)</span>
              </label>
              <span className="text-caption text-ink-subtle">Auto-generated from IBSE standards</span>
            </div>
            <textarea
              value={_rubric}
              onChange={(e) => _onRubricChange(e.target.value)}
              rows={5}
              className="input-textarea"
              placeholder={`Optional: paste your own answer key or grading notes...\n\nQ1: 42 (2 pts)\nQ2: 8 (3 pts, show work)\nQ3: Essay — thesis, evidence, conclusion`}
              disabled={isLoading}
            />
          </div>
        )}

        {/* ─── Subject Dropdown ─── */}
        <div>
          <label className="block text-body-sm font-medium text-ink mb-2">Subject</label>
          <select
            value={_subject}
            onChange={(e) => _onSubjectChange(e.target.value)}
            className="input-select"
            disabled={isLoading}
          >
            {SUBJECTS.map((subj) => (
              <option key={subj} value={subj}>{subj}</option>
            ))}
          </select>
        </div>

        {/* ─── Grade Button ─── */}
        <div className="pt-2">
          <button
            onClick={onGradeClick}
            disabled={!isReady || isLoading || isExtractingRubric}
            className="btn-primary"
          >
            {isLoading || isExtractingRubric ? (
              <>
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>{isLoading ? 'Grading…' : 'Extracting rubric…'}</span>
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
            <p className="text-center text-caption text-ink-muted mt-3">
              {useCustomRubric
                ? customRubricImage
                  ? 'Ready to go — hit "Grade This Homework"'
                  : 'Upload your answer key image to enable grading'
                : image
                ? 'Ready — auto-grade from IBSE standards'
                : 'Upload an image to get started'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}