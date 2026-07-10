/**
 * Vercel Serverless Function: Extract Custom Rubric (OCR)
 * POST /api/extract-rubric
 * Body: { imageBase64, mimeType }
 * Returns: JSON array of { question_number, correct_answer, points_possible }
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { imageBase64, mimeType } = req.body

  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: 'Missing required fields: imageBase64, mimeType' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured on server' })
  }

  const prompt = 'You are reading a teacher\'s answer key / rubric document. Transcribe it into a structured rubric.\n\nReturn ONLY a JSON array where each item has:\n{\n  "question_number": "string (e.g., \\"1\\", \\"2a\\", \\"Q3\\")",\n  "correct_answer": "string - the correct answer or expected response",\n  "points_possible": "number - maximum points for this question"\n}\n\nInclude all questions found. If points are not explicitly listed, estimate based on complexity (1-5 points typical).'

  try {
    const parts = [{ text: prompt }]
    
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

    let parsed
    try {
      const jsonText = text.replace(/```json\n?|\n?```/g, '').trim()
      parsed = JSON.parse(jsonText)
    } catch {
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

    if (!Array.isArray(parsed)) {
      throw new Error('Expected JSON array response from Gemini')
    }

    return res.status(200).json(parsed)
  } catch (error) {
    console.error('Extract rubric error:', error)
    return res.status(500).json({ error: error.message })
  }
}