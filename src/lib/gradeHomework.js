/**
 * Homework Grader AI Pipeline
 * Calls Vercel serverless functions for Gemini API operations.
 * API key is kept server-side only. Endpoints require auth (Phase 4).
 *
 * 401 handling: on any 401 response, tries to refresh the access token
 * via /api/auth/refresh, then retries the original request once.
 * If refresh fails, throws an auth error so the UI can redirect to login.
 */

/**
 * Convert File to base64 string.
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Fetch IBSE standards for grade/subject. Public endpoint — no auth needed.
 * Returns plain text dump or null if unavailable.
 */
async function fetchStandards(gradeLevel, subject) {
  try {
    const response = await fetch('/api/get-standard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gradeLevel, subject }),
    });

    if (!response.ok) {
      console.warn('Standards fetch failed:', response.status);
      return null;
    }

    const data = await response.json();
    return data.standardsText || null;
  } catch (e) {
    console.warn('Standards fetch error:', e.message);
    return null;
  }
}

/**
 * Auth-protected fetch wrapper.
 * Sends credentials: 'include' so HTTP-only cookies are attached.
 * On 401: attempts token refresh, then retries once.
 *
 * @param {string} url - API endpoint
 * @param {object} options - fetch options (method, body, etc.)
 * @returns {Promise<Response>}
 * @throws {Error} with message 'auth_required' if refresh fails
 */
async function authFetch(url, options = {}) {
  let res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    // Try to refresh the access token
    const refreshRes = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });

    if (refreshRes.ok) {
      // Token refreshed — retry the original request
      res = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
    } else {
      // Refresh failed — session is dead
      throw new Error('auth_required');
    }
  }

  return res;
}

/**
 * Extract handwriting from homework image.
 * Calls POST /api/extract (auth-protected).
 */
export async function extractHandwriting(imageFile, gradeLevel, subject) {
  const imageBase64 = await fileToBase64(imageFile);
  const mimeType = imageFile.type || 'image/jpeg';
  const standardsText = await fetchStandards(gradeLevel, subject);

  const response = await authFetch('/api/extract', {
    method: 'POST',
    body: JSON.stringify({
      imageBase64,
      mimeType,
      gradeLevel,
      subject,
      standardsText,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Extract API error: ' + response.status);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error('Invalid response format from extract API');
  }

  return data;
}

/**
 * Grade the submission.
 * Calls POST /api/grade (auth-protected).
 */
export async function gradeSubmission(extractedQuestions, rubric, gradeLevel, subject, standardsText = null) {
  const standards = standardsText || (rubric ? null : await fetchStandards(gradeLevel, subject));

  const response = await authFetch('/api/grade', {
    method: 'POST',
    body: JSON.stringify({
      extractedQuestions,
      rubric: rubric || null,
      standardsText: standards,
      gradeLevel,
      subject,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Grade API error: ' + response.status);
  }

  const data = await response.json();

  if (!data.questions || !Array.isArray(data.questions) || !data.overall) {
    throw new Error('Invalid response format from grade API');
  }

  return data;
}

/**
 * Extract custom rubric from uploaded image (OCR).
 * Calls POST /api/extract-rubric (auth-protected).
 */
export async function extractCustomRubric(imageFile) {
  const imageBase64 = await fileToBase64(imageFile);
  const mimeType = imageFile.type || 'image/jpeg';

  const response = await authFetch('/api/extract-rubric', {
    method: 'POST',
    body: JSON.stringify({
      imageBase64,
      mimeType,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Extract rubric API error: ' + response.status);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error('Invalid response format from extract rubric API');
  }

  return data;
}

/**
 * Calculate letter grade from percentage.
 */
export function calculateLetterGrade(percentage) {
  if (percentage >= 97) return 'A+';
  if (percentage >= 93) return 'A';
  if (percentage >= 90) return 'A-';
  if (percentage >= 87) return 'B+';
  if (percentage >= 83) return 'B';
  if (percentage >= 80) return 'B-';
  if (percentage >= 77) return 'C+';
  if (percentage >= 73) return 'C';
  if (percentage >= 70) return 'C-';
  if (percentage >= 67) return 'D';
  return 'F';
}