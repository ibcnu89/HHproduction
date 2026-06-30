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
 * Function 1: Extract handwriting from homework image
 * Now calls /api/extract Vercel serverless function
 * @param {File} imageFile - The uploaded image file
 * @param {string} gradeLevel - Grade level (K, 1st, 2nd, 3rd, 4th, 5th)
 * @param {string} subject - Subject (Math, Reading, Writing, Science, Other)
 * @returns {Promise<Array>} Array of { question_number, question_text, student_answer }
 */
export async function extractHandwriting(imageFile, gradeLevel, subject) {
  const imageBase64 = await fileToBase64(imageFile)
  
  // Determine mime type from file
  const mimeType = imageFile.type || 'image/jpeg'

  const response = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64,
      mimeType,
      gradeLevel,
      subject
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Extract API error: ${response.status}`)
  }

  const data = await response.json()
  
  if (!Array.isArray(data)) {
    throw new Error('Invalid response format from extract API')
  }

  return data
}

/**
 * Function 2: Grade the submission against the rubric
 * Now calls /api/grade Vercel serverless function
 * @param {Array} extractedQuestions - Array from extractHandwriting
 * @param {string} rubric - Teacher's answer key/rubric text
 * @param {string} gradeLevel - Grade level
 * @param {string} subject - Subject
 * @returns {Promise<Object>} { questions: Array, overall: Object }
 */
export async function gradeSubmission(extractedQuestions, rubric, gradeLevel, subject) {
  const response = await fetch('/api/grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      extractedQuestions,
      rubric,
      gradeLevel,
      subject
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Grade API error: ${response.status}`)
  }

  const data = await response.json()

  if (!data.questions || !Array.isArray(data.questions) || !data.overall) {
    throw new Error('Invalid response format from grade API')
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