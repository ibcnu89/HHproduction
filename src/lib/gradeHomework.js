/**
 * Homework Grader AI Pipeline
 * Calls Vercel serverless functions for Gemini API operations
 * API key is kept server-side only
 */

/**
 * Convert File to base64 string
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Fetch IBSE (Iowa Board of Educational Standards — same data shape as Illinois Learning Standards) for grade/subject.
 * Returns plain text dump or null if unavailable.
 */
async function fetchStandards(gradeLevel, subject) {
  try {
    const response = await fetch('/api/get-standard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gradeLevel, subject })
    })

    if (!response.ok) {
      console.warn('Standards fetch failed:', response.status)
      return null
    }

    const data = await response.json()
    return data.standardsText || null
  } catch (e) {
    console.warn('Standards fetch error:', e.message)
    return null
  }
}

/**
 * Function 1: Extract handwriting from homework image.
 * Calls /api/extract. Pulls standards in so the OCR pass can already anchor correct answers per question type.
 */
export async function extractHandwriting(imageFile, gradeLevel, subject) {
  const imageBase64 = await fileToBase64(imageFile)
  const mimeType = imageFile.type || 'image/jpeg'
  const standardsText = await fetchStandards(gradeLevel, subject)

  const response = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64,
      mimeType,
      gradeLevel,
      subject,
      standardsText: standardsText
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Extract API error: ' + response.status)
  }

  const data = await response.json()

  if (!Array.isArray(data)) {
    throw new Error('Invalid response format from extract API')
  }

  return data
}

/**
 * Function 2: Grade the submission.
 *
 * `rubric` is OPTIONAL. When omitted/empty, the grade endpoint auto-generates
 * the rubric from the IBSE standards anchored to the OCR'd questions.
 * When provided, it overrides the auto-rubric (teacher answer key wins).
 */
export async function gradeSubmission(extractedQuestions, rubric, gradeLevel, subject, standardsText = null) {
  // Always pull the standards so the backend has them, even when we're
  // letting the teacher key take precedence — useful for context tone.
  const standards = standardsText || (rubric ? null : await fetchStandards(gradeLevel, subject))

  const response = await fetch('/api/grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      extractedQuestions,
      rubric: rubric || null,
      standardsText: standards,
      gradeLevel,
      subject
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Grade API error: ' + response.status)
  }

  const data = await response.json()

  if (!data.questions || !Array.isArray(data.questions) || !data.overall) {
    throw new Error('Invalid response format from grade API')
  }

  return data
}

/**
 * Function 3: Extract custom rubric from uploaded image (OCR).
 * Used when the teacher opts into "use my own answer key".
 */
export async function extractCustomRubric(imageFile) {
  const imageBase64 = await fileToBase64(imageFile)
  const mimeType = imageFile.type || 'image/jpeg'

  const response = await fetch('/api/extract-rubric', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64,
      mimeType
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Extract rubric API error: ' + response.status)
  }

  const data = await response.json()

  if (!Array.isArray(data)) {
    throw new Error('Invalid response format from extract rubric API')
  }

  return data
}

/**
 * Calculate letter grade from percentage
 */
export function calculateLetterGrade(percentage) {
  if (percentage >= 97) return 'A+'
  if (percentage >= 93) return 'A'
  if (percentage >= 90) return 'A-'
  if (percentage >= 87) return 'B+'
  if (percentage >= 83) return 'B'
  if (percentage >= 80) return 'B-'
  if (percentage >= 77) return 'C+'
  if (percentage >= 73) return 'C'
  if (percentage >= 70) return 'C-'
  if (percentage >= 67) return 'D'
  return 'F'
}
