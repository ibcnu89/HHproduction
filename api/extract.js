/**
 * Vercel Serverless Function: Extract Handwriting
 * POST /api/extract
 * Body: { imageBase64, mimeType, gradeLevel, subject, standardsText }
 * Returns: JSON array of extracted questions
 */

import { requireAuth } from '../lib/auth.js';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = requireAuth(req, res);
  if (!user) return;

  const { imageBase64, mimeType, gradeLevel, subject, standardsText } = req.body

  // Validate required fields
  if (!imageBase64 || !mimeType || !gradeLevel || !subject) {
    return res.status(400).json({ error: 'Missing required fields: imageBase64, mimeType, gradeLevel, subject' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured on server' })
  }

  let prompt = 'You are reading a child\'s handwritten homework. Grade level: ' + gradeLevel + '. Subject: ' + subject + '. \n\nTranscribe every question and the child\'s handwritten answer exactly as written, preserving question numbers and structure. If an answer is blank, note it as [blank].\n\n'

  if (standardsText) {
    prompt += 'Use the following Illinois Learning Standards as your baseline reference when proposing correct answers and point values:\n' + standardsText + '\n\n'
  }

  prompt += 'Return ONLY a JSON array where each item has:\n{\n  "question_number": "string (e.g., \\"1\\", \\"2a\\", \\"Q3\\")",\n  "question_text": "string - the full question text as visible",\n  "student_answer": "string - exactly what the student wrote"\n}'

  try {
    const parts = [{ text: prompt }]
    
    // Add image data
    parts.unshift({
      inline_data: {
        mime_type: mimeType,
        data: imageBase64
      }
    })

    const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=' + apiKey

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
      throw new Error('Gemini API error: ' + response.status + ' - ' + error)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

    if (!text) {
      throw new Error('Empty response from Gemini API')
    }

    // Parse JSON from response (handle potential markdown code fences)
    let parsed
    try {
      const jsonText = text.replace(/```json\n?|\n?```/g, '').trim()
      parsed = JSON.parse(jsonText)
    } catch {
      // Retry once with stricter prompt
      const retryPrompt = prompt + '\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation.'
      const retryParts = [{ text: retryPrompt }, parts[1]]
      
      const retryResponse = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: retryParts }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
          }
        })
      })

      if (!retryResponse.ok) {
        const error = await retryResponse.text()
        throw new Error('Gemini API retry error: ' + retryResponse.status + ' - ' + error)
      }

      const retryData = await retryResponse.json()
      const retryText = retryData.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      
      if (!retryText) {
        throw new Error('Empty response from Gemini API on retry')
      }

      const retryJsonText = retryText.replace(/```json\n?|\n?```/g, '').trim()
      parsed = JSON.parse(retryJsonText)
    }

    // Validate response is an array
    if (!Array.isArray(parsed)) {
      throw new Error('Expected JSON array response from Gemini')
    }

    return res.status(200).json(parsed)
  } catch (error) {
    console.error('Extract handwriting error:', error)
    return res.status(500).json({ error: error.message })
  }
}