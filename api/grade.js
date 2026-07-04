/**
 * Vercel Serverless Function: Grade Submission
 * POST /api/grade
 * Body: {
 *   extractedQuestions,
 *   rubric,            // optional. Teacher-provided answer key/notes (free text or JSON array from OCR).
 *                      // If absent or empty, a rubric is auto-generated from the standards anchored to the OCR'd questions.
 *   standardsText,     // optional but recommended when rubric is absent.
 *                      // Plain-text dump of the IBSE standards for (gradeLevel, subject).
 *   gradeLevel,
 *   subject
 * }
 *
 * Returns: { questions: [...], overall: { total_points_earned, total_points_possible, letter_grade, encouragement_message } }
 */

function getStrictnessGuidance(gradeLevel) {
  const gradeNum = gradeLevel === 'K' ? 0 : parseInt(gradeLevel.replace(/st|nd|rd|th/, ''), 10);

  if (gradeNum <= 2) {
    return `STRICTNESS: GENTLE (Grades K-2)
- Focus on effort and conceptual understanding over mechanical correctness
- Spelling/grammar errors are expected — do not penalize heavily
- Handwriting legibility issues are normal — grade what you can decipher
- Partial credit generously for showing any reasoning or attempt
- Encouragement should dominate feedback (3:1 positive to constructive ratio)`;
  } else if (gradeNum <= 5) {
    return `STRICTNESS: MODERATE (Grades 3-5)
- Basic spelling of grade-appropriate words should be correct (sight words, common vocabulary)
- Capitalization and end punctuation expected consistently
- Math: calculation errors penalized, but credit for correct setup/process
- Writing: paragraph structure, topic sentences expected
- Science/Other: accurate terminology for concepts taught at this level
- Feedback balanced: acknowledge effort, note specific areas to improve`;
  } else if (gradeNum <= 8) {
    return `STRICTNESS: FIRM (Grades 6-8)
- Spelling/grammar: minimal errors expected; common words must be correct
- Math: calculation accuracy required; partial credit only for clear process with minor arithmetic slip
- Writing: thesis, evidence, transitions, conclusion structure required
- Science: precise vocabulary, correct units, logical reasoning
- Multi-step problems: all steps must be shown and logically connected
- Feedback direct: clearly identify errors and what mastery looks like`;
  } else if (gradeNum <= 10) {
    return `STRICTNESS: HIGH (Grades 9-10)
- Near-professional mechanics: spelling, grammar, punctuation nearly flawless
- Math: precision required; correct setup with arithmetic error = minor deduction
- Writing: sophisticated structure, varied syntax, strong evidence integration
- Science: technical accuracy, proper notation, justified conclusions
- Analysis over recall: synthesis, evaluation, original thinking rewarded
- Feedback specific and standards-referenced; "good effort" insufficient`;
  } else {
    return `STRICTNESS: VERY HIGH / COLLEGE-READY (Grades 11-12)
- Mechanics essentially perfect; errors indicate lack of proofreading
- Math: rigorous notation, complete logical chain, exact answers expected
- Writing: college-level argumentation, nuance, counter-argument handling
- Science/Other: disciplinary conventions, citations, uncertainty acknowledgment
- Independent insight, critical analysis, and synthesis required for top scores
- Feedback evaluative: measures against external standards (AP, IB, college rubrics)
- Grade inflation actively avoided — A range reserved for exceptional work`;
  }
}

function buildAutoRubricInstructions(gradeLevel, subject, standardsText) {
  const standardsBlock = standardsText
    ? `\nSTANDARDS REFERENCE (use these as your rubric backbone — the auto-generated correct answers and point values MUST be defensible against these standards):\n${standardsText}\n`
    : `\nNo standards were loaded. Fall back to general ${subject} norms for grade ${gradeLevel}.\n`;

  return `RUBRIC MODE: AUTO-GENERATED (no teacher answer key provided)

For each question in the student's submission, you must:
1. Infer the most likely correct answer using:
   - The question text from OCR
   - Grade ${gradeLevel} ${subject} expectations
   - The standards reference below
2. Assign points_possible using these per-question heuristics:
   - Multiple-choice / single number / short fill-in: 1 point
   - Multi-step math / short constructed response: 2-3 points
   - Multi-part question (e.g. "2a, 2b, 2c"): list each sub-part; each sub-part 1-2 points
   - Extended response / short essay (3+ sentences expected): 4-5 points
3. When a question is ambiguous or under-specified, prefer the simpler answer typical of grade-level classroom work. Bias toward allowing partial credit.
${standardsBlock}
In your JSON output, populate "correct_answer" with the inferred answer (so the teacher can review it). Set "points_possible" per the heuristics above. Set "is_correct" and "points_earned" based on how the student's answer compares to the inferred correct answer.`;
}

function buildAnswerKeyRubricInstructions() {
  return `RUBRIC MODE: TEACHER-PROVIDED ANSWER KEY

A teacher has supplied an answer key / rubric. Treat it as authoritative for "correct_answer" and "points_possible" per question. Where the key lists grading notes (partial credit, required elements), honor them.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { extractedQuestions, rubric, standardsText, gradeLevel, subject } = req.body;

  if (!extractedQuestions || !gradeLevel || !subject) {
    return res.status(400).json({ error: 'Missing required fields: extractedQuestions, gradeLevel, subject' });
  }

  if (!Array.isArray(extractedQuestions)) {
    return res.status(400).json({ error: 'extractedQuestions must be an array' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured on server' });
  }

  const hasRubric = typeof rubric === 'string' && rubric.trim().length > 0;
  const rubricModeBlock = hasRubric
    ? buildAnswerKeyRubricInstructions()
    : buildAutoRubricInstructions(gradeLevel, subject, standardsText);

  const rubricSection = hasRubric
    ? `\nTeacher's answer key / rubric (authoritative):\n${rubric}\n`
    : `\nNo teacher answer key provided. ${standardsText ? 'Generate the rubric from the standards reference above.' : 'Generate the rubric from subject + grade-level norms.'}\n`;

  const prompt = `You are a kind, encouraging teacher. Grade level: ${gradeLevel}. Subject: ${subject}.

Student's answers (from OCR of handwritten homework):
${JSON.stringify(extractedQuestions, null, 2)}
${rubricSection}

${rubricModeBlock}

${getStrictnessGuidance(gradeLevel)}

Return ONLY a JSON object with this exact structure:
{
  "rubric_mode": "${hasRubric ? 'teacher_key' : 'auto_generated'}",
  "questions": [
    {
      "question_number": "string",
      "question_text": "string (echo the OCR'd question text verbatim)",
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
}`;

  try {
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const parts = [{ text: prompt }];

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
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    let parsed;
    try {
      const jsonText = text.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(jsonText);
    } catch {
      const retryPrompt = `${prompt}\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation.`;

      const retryResponse = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: retryPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
          }
        })
      });

      if (!retryResponse.ok) {
        const error = await retryResponse.text();
        throw new Error(`Gemini API retry error: ${retryResponse.status} - ${error}`);
      }

      const retryData = await retryResponse.json();
      const retryText = retryData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!retryText) {
        throw new Error('Empty response from Gemini API on retry');
      }

      const retryJsonText = retryText.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(retryJsonText);
    }

    if (!parsed.questions || !Array.isArray(parsed.questions) || !parsed.overall) {
      throw new Error('Invalid response structure from Gemini API');
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Grade submission error:', error);
    return res.status(500).json({ error: error.message });
  }
}
