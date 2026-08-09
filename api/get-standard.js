/**
 * Vercel Serverless Function: Get State Learning Standards
 * POST /api/get-standard
 * Body: { gradeLevel, subject, stateCode }
 * Returns: { standardsText: string | null, error: string | null }
 */

const fs = require('fs');
const path = require('path');
const { commonCore, states } = require('./standards-data.js');

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

// Get state code from user preferences or use default
function getStateCode(reqStateCode) {
  const code = (reqStateCode || 'IL').toUpperCase();
  if (states[code]) return code;
  return 'IL';
}

// Get standards for a specific state
function getStateStandards(stateCode, subject, gradeLevel) {
  // Check if state uses commonCore
  const stateInfo = states[stateCode];
  if (!stateInfo || stateInfo.source !== 'commonCore') {
    return null;
  }
  
  // Get from commonCore
  const subjectData = commonCore[subject];
  if (!subjectData) return null;
  
  return subjectData[gradeLevel] || null;
}

function formatStandardsText(stateName, subject, gradeLevel, standards) {
  if (!standards || standards.length === 0) return null;
  
  let text = `${stateName} Learning Standards for ${subject} ${gradeLevel} Grade:\n\n`;
  standards.forEach((s, i) => {
    text += `${i + 1}. ${s.code}: ${s.description}\n`;
  });
  return text;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gradeLevel, subject, stateCode } = req.body;

  if (!gradeLevel || !subject) {
    return res.status(400).json({ error: 'Missing required fields: gradeLevel, subject' });
  }

  const stateCodeUpper = getStateCode(stateCode);
  const stateInfo = states[stateCodeUpper] || states['IL'];
  const stateName = stateInfo.name || stateCodeUpper;

  const normGrade = normalizeGradeLevel(gradeLevel);
  
  const standards = getStateStandards(stateCodeUpper, subject, normGrade);
  
  if (!standards || standards.length === 0) {
    return res.status(200).json({ 
      standardsText: null, 
      error: `No standards found for ${subject} ${normGrade} (using ${stateName} standards)` 
    });
  }

  const standardsText = formatStandardsText(stateName, subject, normGrade, standards);
  
  return res.status(200).json({
    standardsText,
    error: null,
    gradeLevel: normGrade,
    subject,
    stateCode: stateCodeUpper,
    stateName,
    count: standards.length
  });
}