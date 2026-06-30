/**
 * Vercel Serverless Function: Get Illinois Learning Standards
 * POST /api/get-standard
 * Body: { gradeLevel, subject }
 * Returns: { standardsText: string | null, error: string | null }
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '_standards_data.json');

// Load standards data once at startup
let standardsCache = null;
function loadStandards() {
  if (standardsCache) return standardsCache;
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    standardsCache = JSON.parse(data);
    return standardsCache;
  } catch (e) {
    console.error('Failed to load standards data:', e.message);
    return null;
  }
}

// Convert grade level input to standard format
function normalizeGradeLevel(gradeLevel) {
  const map = {
    'k': 'K',
    'kindergarten': 'K',
    '1': '1st', '1st': '1st', 'first': '1st',
    '2': '2nd', '2nd': '2nd', 'second': '2nd',
    '3': '3rd', '3rd': '3rd', 'third': '3rd',
    '4': '4th', '4th': '4th', 'fourth': '4th',
    '5': '5th', '5th': '5th', 'fifth': '5th',
    '6': '6th', '6th': '6th', 'sixth': '6th',
    '7': '7th', '7th': '7th', 'seventh': '7th',
    '8': '8th', '8th': '8th', 'eighth': '8th',
    '9': '9th', '9th': '9th', 'ninth': '9th',
    '10': '10th', '10th': '10th', 'tenth': '10th',
    '11': '11th', '11th': '11th', 'eleventh': '11th',
    '12': '12th', '12th': '12th', 'twelfth': '12th',
  };
  const key = gradeLevel.toLowerCase().trim();
  return map[key] || gradeLevel;
}

function formatStandardsText(subject, gradeLevel, standards) {
  if (!standards || standards.length === 0) return null;
  
  let text = `Illinois Learning Standards for ${subject} ${gradeLevel} Grade:\n\n`;
  standards.forEach((s, i) => {
    text += `${i + 1}. ${s.code}: ${s.description}\n`;
  });
  return text;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gradeLevel, subject } = req.body;

  if (!gradeLevel || !subject) {
    return res.status(400).json({ error: 'Missing required fields: gradeLevel, subject' });
  }

  const data = loadStandards();
  if (!data) {
    return res.status(500).json({ 
      standardsText: null, 
      error: 'Standards data not available' 
    });
  }

  const normGrade = normalizeGradeLevel(gradeLevel);
  const subjectData = data[subject];

  if (!subjectData) {
    return res.status(200).json({ 
      standardsText: null, 
      error: `Subject "${subject}" not found in standards data` 
    });
  }

  const standards = subjectData[normGrade];
  if (!standards || standards.length === 0) {
    return res.status(200).json({ 
      standardsText: null, 
      error: `No standards found for ${subject} ${normGrade}` 
    });
  }

  const standardsText = formatStandardsText(subject, normGrade, standards);
  
  return res.status(200).json({
    standardsText,
    error: null,
    gradeLevel: normGrade,
    subject,
    count: standards.length
  });
}