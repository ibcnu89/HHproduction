/**
 * Homework Grader AI Pipeline
 * Uses Gemini 2.5 Flash API for OCR and grading
 * 
 * API Key: Set VITE_GEMINI_API_KEY in .env file
 * Get key from: https://aistudio.google.com/app/apikey
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

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
 * Call Gemini API with retry logic for JSON parsing
 */
async function callGemini(prompt, imageBase64 = null, retryCount = 0) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_g...re') {
    throw new Error('Gemini API key not configured. Please set VITE_GEMINI_API_KEY in .env file.')
  }

  const parts = [{ text: prompt }]
  if (imageBase64) {
    parts.unshift({
      inline_data: {
        mime_type: 'image/jpeg',
        data: imageBase64
      }
    })
  }

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
      }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

  if (!text) {
    throw new Error('Empty response from Gemini API')
  }

  // Try to parse JSON from response
  let parsed
  try {
    // Handle potential markdown code fences
    const jsonText = text.replace(/```json\n?|\n?```/g, '').trim()
    parsed = JSON.parse(jsonText)
  } catch (parseError) {
    if (retryCount < 1) {
      // Retry once with stricter prompt
      return callGemini(`${prompt}\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation.`, imageBase64, retryCount + 1)
    }
    throw new Error(`Failed to parse JSON from API response: ${parseError.message}`)
  }

  return parsed
}

/**
 * Function 1: Extract handwriting from homework image
 * @param {File} imageFile - The uploaded image file
 * @param {string} gradeLevel - Grade level (K, 1st, 2nd, 3rd, 4th, 5th)
 * @param {string} subject - Subject (Math, Reading, Writing, Science, Other)
 * @returns {Promise<Array>} Array of { question_number, question_text, student_answer }
 */
export async function extractHandwriting(imageFile, gradeLevel, subject) {
  const imageBase64 = await fileToBase64(imageFile)

  const prompt = `You are reading a child's handwritten homework. Grade level: ${gradeLevel}. Subject: ${subject}. 

Transcribe every question and the child's handwritten answer exactly as written, preserving question numbers and structure. If an answer is blank, note it as [blank].

Return ONLY a JSON array where each item has:
{
  "question_number": "string (e.g., "1", "2a", "Q3")",
  "question_text": "string - the full question text as visible",
  "student_answer": "string - exactly what the student wrote"
}`

  return callGemini(prompt, imageBase64)
}

/**
 * Function 2: Grade the submission against the rubric
 * @param {Array} extractedQuestions - Array from extractHandwriting
 * @param {string} rubric - Teacher's answer key/rubric text
 * @param {string} gradeLevel - Grade level
 * @param {string} subject - Subject
 * @returns {Promise<Object>} { questions: Array, overall: Object }
 */
export async function gradeSubmission(extractedQuestions, rubric, gradeLevel, subject) {
  const prompt = `You are a kind, encouraging elementary school teacher. Grade level: ${gradeLevel}. Subject: ${subject}.

Student's answers:
${JSON.stringify(extractedQuestions, null, 2)}

Teacher's answer key / rubric:
${rubric}

Grade each question fairly. Be encouraging but accurate.

Return ONLY a JSON object with this exact structure:
{
  "questions": [
    {
      "question_number": "string",
      "student_answer": "string",
      "correct_answer": "string",
      "is_correct": true,
      "points_earned": number,
      "points_possible": number,
      "feedback": "string - one encouraging sentence explaining what was right or what to work on"
    }
  ],
  "overall": {
    "total_points_earned": number,
    "total_points_possible": number,
    "letter_grade": "string (A+, A, A-, B+, B, B-, C+, C, C-, D, F)",
    "encouragement_message": "string - warm, encouraging message for the student"
  }
}`

  return callGemini(prompt)
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