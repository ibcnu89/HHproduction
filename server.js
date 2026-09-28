/**
 * Railway Express Server — HHproduction
 *
 * Replaces Vercel serverless functions with a single Express process.
 * Railway runs: node server.js
 *
 * Architecture:
 *   - API routes (/api/*) → Express route handlers
 *   - Static SPA (/*) → serve dist/ folder, SPA fallback to index.html
 *   - CORS: handled via Railway's edge proxy (X-Forwarded-Host)
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getClient } from './lib/db.js';
import {
  verifyPassword,
  hashPassword,
  validatePasswordStrength,
} from './lib/password.js';
import {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './lib/jwt.js';
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  getCookie,
  clearAuthCookies,
} from './lib/cookies.js';
import { requireAuth } from './lib/auth.js';
import { readUtmFromRequest } from './lib/utm.js';
import { requestPasswordReset, completePasswordReset } from './lib/password-reset.js';
import { storeOAuthState, verifyAndConsumeOAuthState, createTempSessionId, getSessionIdFromRequest, setTempSessionCookie, getTempSessionCookie, clearTempSessionCookie } from './lib/oauth-state.js';
import { safeAppRedirect } from './lib/redirect-safe.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Stripe from 'stripe';
import multer from 'multer';
import { getClassroomAuthUrl, exchangeClassroomCode, storeClassroomTokens, revokeClassroomTokens, getClassroomConnectionStatus } from './lib/google-classroom.js';
import { syncUserClassroom } from './lib/classroom-sync.js';
import { pushGradeToClassroom } from './lib/classroom-grades.js';
import { checkoutHandler, statusHandler, plansHandler, processBillingEvent, getStripe, billingStatus, requireSubscription } from './lib/billing.js';
import { recordGeminiUsage, getUsageSummary } from './lib/ai-usage.js';

// Configure multer for batch grading (memory storage for base64 conversion)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 50 // max 50 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'));
    }
  }
});

// ── Helpers ──────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect domain from Railway env or fall back
// FRONTEND_URL must match the origin users actually browse. GOOGLE_REDIRECT_URI
// is the fixed anchor registered in the Google Console (apex). Deriving the
// public origin from it prevents a www/apex mismatch: RAILWAY_PUBLIC_DOMAIN
// changed to www.letsmakeai.fun after the last deploy while Google, DNS and
// users all use the apex — mixing them silently broke auth cookies in Chrome.
const RAILWAY_PUBLIC_DOMAIN = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_SERVICE_HHPRODUCTION_URL || 'localhost';
const FRONTEND_URL =
  (process.env.GOOGLE_REDIRECT_URI && new URL(process.env.GOOGLE_REDIRECT_URI).origin) ||
  process.env.APP_URL ||
  `https://${RAILWAY_PUBLIC_DOMAIN}`;
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

// NOTE: COOKIE_DOMAIN is no longer used in cookie options (see lib/cookies.js).
// Keeping the env var for backward compatibility but cookies now bind to exact origin.
const _cookieDomainUnused = COOKIE_DOMAIN;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
// Allow explicit redirect URI override for Google Cloud Console exact match
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${FRONTEND_URL}/api/auth/google/callback`;
const REDIRECT_URI = GOOGLE_REDIRECT_URI;

// ── Password Reset Helpers (replaced by lib/password-reset.js) ────────────
// Old createResetToken function removed - now using secure token store in lib/password-reset.js

async function makeSession(client, userId, userAgent) {
  const r = await client.query(
    `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, expires_at)
     VALUES ($1, 'pending', $2, NOW() + INTERVAL '7 days')
     RETURNING id`,
    [userId, userAgent || null]
  );
  return r.rows[0].id;
}

async function storeRefreshHash(client, sessionId, refreshToken) {
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await client.query(
    'UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2',
    [hash, sessionId]
  );
}

function issueCookies(res, user, sessionId, rememberMe) {
  const accessToken = createAccessToken(user, sessionId);
  const refreshToken = createRefreshToken(user.id, sessionId, !!rememberMe);
  setAccessTokenCookie(res, accessToken);
  setRefreshTokenCookie(res, refreshToken, !!rememberMe);
  return refreshToken;
}

function userResponse(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
  };
}

// ── Standards data loader ────────────────────────────────────────────
// Embedded Common Core standards (all grades K-12) for Common Core states
import { commonCore } from './scripts/expanded-common-core.js';

const states = {
  IL: { name: "Illinois", source: "commonCore" },
  CA: { name: "California", source: "commonCore" },
  TX: { name: "Texas", source: "TEKS" },
  FL: { name: "Florida", source: "B.E.S.T." },
  VA: { name: "Virginia", source: "SOL" },
  NY: { name: "New York", source: "commonCore" },
  PA: { name: "Pennsylvania", source: "commonCore" },
  OH: { name: "Ohio", source: "commonCore" },
  GA: { name: "Georgia", source: "commonCore" },
  NC: { name: "North Carolina", source: "commonCore" },
  MI: { name: "Michigan", source: "commonCore" }
};

// State-specific standards (non-Common Core)
const stateStandards = {
  TX: {
    Math: {
      "5th": [
        { code: "5.1.A", description: "[Texas] Apply mathematics to problems arising in everyday life, society, and the workplace." },
        { code: "5.1.B", description: "[Texas] Use a problem-solving model that incorporates analyzing given information, formulating a plan or strategy, determining a solution, justifying the solution, and evaluating the problem-solving process and the reasonableness of the solution." },
        { code: "5.1.C", description: "[Texas] Select tools, including real objects, manipulatives, paper and pencil, and technology as appropriate, and techniques, including mental math, estimation, and number sense as appropriate, to solve problems." },
        { code: "5.1.D", description: "[Texas] Communicate mathematical ideas, reasoning, and their implications using multiple representations, including symbols, diagrams, graphs, and language as appropriate." },
        { code: "5.1.E", description: "[Texas] Create and use representations to organize, record, and communicate mathematical ideas." },
        { code: "5.1.F", description: "[Texas] Analyze mathematical relationships to connect and communicate mathematical ideas." },
        { code: "5.1.G", description: "[Texas] Display, explain, and justify mathematical ideas and arguments using precise mathematical language in written or oral communication." },
        { code: "5.2.A", description: "[Texas] Represent the value of the digit in decimals through the thousandths using expanded notation and numerals." },
        { code: "5.2.B", description: "[Texas] Compare and order two decimals to thousandths and represent comparisons using the symbols >, <, or =." },
        { code: "5.2.C", description: "[Texas] Round decimals to tenths or hundredths." },
        { code: "5.3.A", description: "[Texas] Estimate to determine solutions to mathematical and real-world problems involving addition, subtraction, multiplication, or division." },
        { code: "5.3.B", description: "[Texas] Multiply with fluency a three-digit number by a two-digit number using the standard algorithm." },
        { code: "5.3.C", description: "[Texas] Solve with proficiency for quotients of up to a four-digit dividend by a two-digit divisor using strategies and the standard algorithm." },
        { code: "5.3.D", description: "[Texas] Represent multiplication of decimals with products to the hundredths using objects and pictorial models, including area models." },
        { code: "5.3.E", description: "[Texas] Solve for products of decimals to the hundredths, including situations involving money, using strategies based on place-value understandings, properties of operations, and the relationship to the multiplication of whole numbers." },
        { code: "5.3.F", description: "[Texas] Represent quotients of decimals to the hundredths, up to four-digit dividends and two-digit whole number divisors, using objects and pictorial models, including area models." },
        { code: "5.3.G", description: "[Texas] Solve for quotients of decimals to the hundredths, up to four-digit dividends and two-digit whole number divisors, using strategies and algorithms, including the standard algorithm." },
        { code: "5.3.H", description: "[Texas] Represent and solve addition and subtraction of fractions with unequal denominators referring to the same whole using objects and pictorial models and properties of operations." },
        { code: "5.3.I", description: "[Texas] Represent and solve multiplication of a whole number and a fraction that refers to the same whole using objects and pictorial models, including area models." },
        { code: "5.3.J", description: "[Texas] Represent division of a unit fraction by a whole number and the division of a whole number by a unit fraction such as 1/3 ÷ 7 and 7 ÷ 1/3 using objects and pictorial models, including area models." },
        { code: "5.3.K", description: "[Texas] Add and subtract positive rational numbers fluently." },
        { code: "5.3.L", description: "[Texas] Divide whole numbers by unit fractions and unit fractions by whole numbers." }
      ]
    },
    ELA: {
      "5th": [
        { code: "5.1.A", description: "[Texas] Read grade-level text with fluency and comprehension. Use context to confirm or self-correct word recognition and understanding, rereading as necessary." },
        { code: "5.2.A", description: "[Texas] Describe personal connections to a variety of sources, including self-selected texts." },
        { code: "5.2.B", description: "[Texas] Write responses that demonstrate understanding of texts, including comparing and contrasting ideas across texts." },
        { code: "5.3.A", description: "[Texas] Identify and explain the use of literary devices, including metaphor, simile, personification, and hyperbole." },
        { code: "5.4.A", description: "[Texas] Use clear and concise language to communicate ideas effectively." },
        { code: "5.5.A", description: "[Texas] Plan a first draft by selecting a genre for a particular purpose and audience." },
        { code: "5.5.B", description: "[Texas] Develop drafts into a focused, structured, and coherent piece of writing." },
        { code: "5.5.C", description: "[Texas] Revise drafts to improve sentence structure and word choice." },
        { code: "5.5.D", description: "[Texas] Edit drafts using standard English conventions." }
      ]
    }
  },
  VA: {
    Math: {
      "5th": [
        { code: "5.1", description: "[Virginia] The student, given a decimal through thousandths, will round to the nearest whole number, tenth, or hundredth." },
        { code: "5.2", description: "[Virginia] The student will represent and identify equivalencies among fractions and decimals, with and without models." },
        { code: "5.3", description: "[Virginia] The student will compare and order fractions, decimals, and mixed numbers." },
        { code: "5.4", description: "[Virginia] The student will create and solve single-step and multistep practical problems involving addition, subtraction, multiplication, and division of whole numbers." },
        { code: "5.5", description: "[Virginia] The student will estimate and determine the product and quotient of two numbers involving decimals." },
        { code: "5.6", description: "[Virginia] The student will solve single-step and multistep practical problems involving addition and subtraction of fractions and mixed numbers." },
        { code: "5.7", description: "[Virginia] The student will simplify whole number numerical expressions using the order of operations." },
        { code: "5.8", description: "[Virginia] The student will describe and determine the perimeter of polygons and the area of rectangles and right triangles." },
        { code: "5.9", description: "[Virginia] The student will identify equivalent measurements within the metric system." },
        { code: "5.10", description: "[Virginia] The student will identify and describe the diameter, radius, chord, and circumference of a circle." },
        { code: "5.11", description: "[Virginia] The student will solve practical problems related to elapsed time in hours and minutes within a 24-hour period." },
        { code: "5.12", description: "[Virginia] The student will classify and measure right, acute, obtuse, and straight angles." },
        { code: "5.13", description: "[Virginia] The student will classify triangles as right, acute, or obtuse and equilateral, scalene, or isosceles." },
        { code: "5.14", description: "[Virginia] The student will recognize and describe the properties of plane figures including parallel, perpendicular, and intersecting lines." },
        { code: "5.15", description: "[Virginia] The student will determine the probability of an outcome by constructing a sample space." },
        { code: "5.16", description: "[Virginia] The student will represent data in line plots and stem-and-leaf plots." },
        { code: "5.17", description: "[Virginia] The student will interpret data represented in line plots and stem-and-leaf plots." },
        { code: "5.18", description: "[Virginia] The student will identify, describe, create, express, and extend number patterns found in objects, pictures, numbers, and tables." },
        { code: "5.19", description: "[Virginia] The student will investigate and describe the concept of variable." },
        { code: "5.20", description: "[Virginia] The student will write an equation to represent a given mathematical relationship, using a variable." }
      ]
    },
    ELA: {
      "5th": [
        { code: "5.1", description: "[Virginia] The student will use effective oral communication skills in a variety of settings." },
        { code: "5.2", description: "[Virginia] The student will use effective nonverbal communication skills." },
        { code: "5.3", description: "[Virginia] The student will listen to and discuss a variety of literary and informational texts." },
        { code: "5.4", description: "[Virginia] The student will expand vocabulary when reading." },
        { code: "5.5", description: "[Virginia] The student will read and demonstrate comprehension of fictional texts, narrative nonfiction, and poetry." },
        { code: "5.6", description: "[Virginia] The student will read and demonstrate comprehension of nonfiction texts." },
        { code: "5.7", description: "[Virginia] The student will write in a variety of forms to include narrative, descriptive, expository, and persuasive." },
        { code: "5.8", description: "[Virginia] The student will self- and peer-edit writing for capitalization, punctuation, spelling, sentence structure, paragraphing, and Standard English." },
        { code: "5.9", description: "[Virginia] The student will find, evaluate, and select appropriate resources for a research product." }
      ]
    }
  },
  FL: {
    Math: {
      "5th": [
        { code: "MA.5.NSO.1.1", description: "[Florida] Express a five-digit number in expanded form and standard form." },
        { code: "MA.5.NSO.1.2", description: "[Florida] Compare multi-digit numbers using >, =, and < symbols." },
        { code: "MA.5.NSO.1.3", description: "[Florida] Round multi-digit whole numbers to any place." },
        { code: "MA.5.NSO.1.4", description: "[Florida] Multiply multi-digit whole numbers using a standard algorithm." },
        { code: "MA.5.NSO.1.5", description: "[Florida] Divide multi-digit whole numbers using a standard algorithm." },
        { code: "MA.5.NSO.2.1", description: "[Florida] Add and subtract multi-digit numbers with decimals to the thousandths." },
        { code: "MA.5.NSO.2.2", description: "[Florida] Multiply and divide multi-digit numbers with decimals to the thousandths." },
        { code: "MA.5.FR.1.1", description: "[Florida] Given a mathematical or real-world problem, represent the division of two whole numbers as a fraction." },
        { code: "MA.5.FR.2.1", description: "[Florida] Add and subtract fractions with unlike denominators, including mixed numbers." },
        { code: "MA.5.FR.2.2", description: "[Florida] Multiply a fraction by a fraction, including mixed numbers." },
        { code: "MA.5.FR.2.3", description: "[Florida] Divide a unit fraction by a whole number and a whole number by a unit fraction." },
        { code: "MA.5.AR.1.1", description: "[Florida] Solve multi-step real-world problems involving any combination of the four operations with whole numbers." },
        { code: "MA.5.AR.1.2", description: "[Florida] Solve real-world problems involving the addition, subtraction, or multiplication of fractions." },
        { code: "MA.5.AR.2.1", description: "[Florida] Translate written real-world and mathematical descriptions into numerical expressions and numerical expressions into written mathematical descriptions." },
        { code: "MA.5.AR.2.2", description: "[Florida] Evaluate multi-step numerical expressions using order of operations." },
        { code: "MA.5.AR.3.1", description: "[Florida] Given a numerical pattern, identify the rule and extend the pattern." },
        { code: "MA.5.GR.1.1", description: "[Florida] Classify triangles or quadrilaterals into different categories based on shared defining attributes." },
        { code: "MA.5.GR.1.2", description: "[Florida] Identify and classify three-dimensional figures into categories based on their defining attributes." },
        { code: "MA.5.GR.2.1", description: "[Florida] Find the perimeter and area of rectangles with fractional or decimal side lengths." },
        { code: "MA.5.GR.2.2", description: "[Florida] Find the volume of a right rectangular prism using a formula." },
        { code: "MA.5.DP.1.1", description: "[Florida] Collect and represent numerical data, including fractional and decimal values, using tables, line graphs, or line plots." },
        { code: "MA.5.DP.1.2", description: "[Florida] Interpret numerical data, including fractional and decimal values, represented with tables, line graphs, or line plots." }
      ]
    },
    ELA: {
      "5th": [
        { code: "ELA.5.R.1.1", description: "[Florida] Analyze how setting, events, conflict, and characterization contribute to the plot in a literary text." },
        { code: "ELA.5.R.1.2", description: "[Florida] Analyze the development of a theme in a literary text." },
        { code: "ELA.5.R.2.1", description: "[Florida] Explain how text features contribute to the meaning of an informational text." },
        { code: "ELA.5.R.2.2", description: "[Florida] Explain how the organizational structure of an informational text contributes to the meaning." },
        { code: "ELA.5.R.3.1", description: "[Florida] Analyze figurative language, including similes, metaphors, personification, and idioms." },
        { code: "ELA.5.C.1.1", description: "[Florida] Write narratives that develop real or imagined experiences using effective technique, descriptive details, and clear event sequences." },
        { code: "ELA.5.C.1.2", description: "[Florida] Write opinion pieces that support a point of view with reasons and evidence." },
        { code: "ELA.5.C.1.3", description: "[Florida] Write expository texts to explain a topic with facts, definitions, and examples." },
        { code: "ELA.5.C.2.1", description: "[Florida] Present information orally, in a logical sequence, using nonverbal cues, appropriate volume, and clear pronunciation." },
        { code: "ELA.5.C.3.1", description: "[Florida] Follow the rules of standard English grammar, punctuation, capitalization, and spelling appropriate to grade level." },
        { code: "ELA.5.V.1.1", description: "[Florida] Use grade-level academic vocabulary appropriately in speaking and writing." },
        { code: "ELA.5.V.1.2", description: "[Florida] Determine the meaning of words using context clues, affixes, and root words." }
      ]
    }
  }
};

function normalizeGradeLevel(gradeLevel) {
  const map = {
    'k': 'K', 'kindergarten': 'K',
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

function formatStandardsText(stateName, subject, gradeLevel, standards) {
  if (!standards || standards.length === 0) return null;
  let text = `${stateName} Learning Standards for ${subject} ${gradeLevel} Grade:\n\n`;
  standards.forEach((s, i) => {
    text += `${i + 1}. ${s.code}: ${s.description}\n`;
  });
  return text;
}

// ── Gemini Grading Helpers ───────────────────────────────────────────

function getStrictnessGuidance(gradeLevel) {
  const gradeNum =
    gradeLevel === 'K' ? 0 : parseInt(gradeLevel.replace(/st|nd|rd|th/, ''), 10);

  if (gradeNum <= 2) {
    return `STRICTNESS: GENTLE (Grades K-2)\n- Focus on effort and conceptual understanding over mechanical correctness\n- Spelling/grammar errors are expected — do not penalize heavily\n- Handwriting legibility issues are normal — grade what you can decipher\n- Partial credit generously for showing any reasoning or attempt\n- Encouragement should dominate feedback (3:1 positive to constructive ratio)`;
  } else if (gradeNum <= 5) {
    return `STRICTNESS: MODERATE (Grades 3-5)\n- Basic spelling of grade-appropriate words should be correct (sight words, common vocabulary)\n- Capitalization and end punctuation expected consistently\n- Math: calculation errors penalized, but credit for correct setup/process\n- Writing: paragraph structure, topic sentences expected\n- Science/Other: accurate terminology for concepts taught at this level\n- Feedback balanced: acknowledge effort, note specific areas to improve`;
  } else if (gradeNum <= 8) {
    return `STRICTNESS: FIRM (Grades 6-8)\n- Spelling/grammar: minimal errors expected; common words must be correct\n- Math: calculation accuracy required; partial credit only for clear process with minor arithmetic slip\n- Writing: thesis, evidence, transitions, conclusion structure required\n- Science: precise vocabulary, correct units, logical reasoning\n- Multi-step problems: all steps must be shown and logically connected\n- Feedback direct: clearly identify errors and what mastery looks like`;
  } else if (gradeNum <= 10) {
    return `STRICTNESS: HIGH (Grades 9-10)\n- Near-professional mechanics: spelling, grammar, punctuation nearly flawless\n- Math: precision required; correct setup with arithmetic error = minor deduction\n- Writing: sophisticated structure, varied syntax, strong evidence integration\n- Science: technical accuracy, proper notation, justified conclusions\n- Analysis over recall: synthesis, evaluation, original thinking rewarded\n- Feedback specific and standards-referenced; "good effort" insufficient`;
  } else {
    return `STRICTNESS: VERY HIGH / COLLEGE-READY (Grades 11-12)\n- Mechanics essentially perfect; errors indicate lack of proofreading\n- Math: rigorous notation, complete logical chain, exact answers expected\n- Writing: college-level argumentation, nuance, counter-argument handling\n- Science/Other: disciplinary conventions, citations, uncertainty acknowledgment\n- Independent insight, critical analysis, and synthesis required for top scores\n- Feedback evaluative: measures against external standards (AP, IB, college rubrics)\n- Grade inflation actively avoided — A range reserved for exceptional work`;
  }
}

function buildAutoRubricInstructions(gradeLevel, subject, standardsText) {
  const standardSubjects = ['Math', 'Reading', 'Writing', 'Science', 'Other'];
  const isCustomSubject = !standardSubjects.includes(subject);

  const standardsBlock = standardsText
    ? `\nSTANDARDS REFERENCE (use these as your rubric backbone — the auto-generated correct answers and point values MUST be defensible against these standards):\n${standardsText}\n`
    : `\nNo standards were loaded. Fall back to general ${subject} norms for grade ${gradeLevel}.\n`;

  const subjectContext = isCustomSubject
    ? `\nIMPORTANT: "${subject}" is a CUSTOM SUBJECT created by the teacher. There are no standard curriculum standards for this subject. Use your general knowledge of what ${gradeLevel} students would typically learn in "${subject}" (skills, concepts, vocabulary, techniques appropriate for this grade level). Apply appropriate expectations for a ${gradeLevel} classroom setting.\n`
    : '';

  return `RUBRIC MODE: AUTO-GENERATED (no teacher answer key provided)\n\nFor each question in the student's submission, you must:\n1. Infer the most likely correct answer using:\n   - The question text from OCR\n   - Grade ${gradeLevel} ${subject} expectations\n   - The standards reference below\n2. Assign points_possible using these per-question heuristics:\n   - Multiple-choice / single number / short fill-in: 1 point\n   - Multi-step math / short constructed response: 2-3 points\n   - Multi-part question (e.g. "2a, 2b, 2c"): list each sub-part; each sub-part 1-2 points\n   - Extended response / short essay (3+ sentences expected): 4-5 points\n3. When a question is ambiguous or under-specified, prefer the simpler answer typical of grade-level classroom work. Bias toward allowing partial credit.${subjectContext}${standardsBlock}\nIn your JSON output, populate "correct_answer" with the inferred answer (so the teacher can review it). Set "points_possible" per the heuristics above. Set "is_correct" and "points_earned" based on how the student's answer compares to the inferred correct answer.`;
}

function buildAnswerKeyRubricInstructions() {
  return `RUBRIC MODE: TEACHER-PROVIDED ANSWER KEY\n\nA teacher has supplied an answer key / rubric. Treat it as authoritative for "correct_answer" and "points_possible" per question. Where the key lists grading notes (partial credit, required elements), honor them.`;
}

// ── Express App ──────────────────────────────────────────────────────

import helmet from 'helmet';

const app = express();

// Trust Railway's proxy (required for secure cookies behind proxy)
app.set('trust proxy', 1);

// ── Security headers (helmet) ────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // disable CSP for now (adjust for production)
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));

// ── Canonical-domain redirect: www → apex ───────────────────────────
// letsmakeai.fun (apex) is the canonical production origin: Google
// Console redirect URIs, FRONTEND_URL derivation, and user links all
// use it. If a user starts at www, any OAuth state cookie set there is
// a www host-only cookie and is NOT sent to the apex callback — a
// dead-session flow. Redirect www requests to the apex origin BEFORE
// authentication starts. Only the exact configured www host matches;
// the destination is a fixed https://letsmakeai.fun origin, never
// derived from the Host header (no Host-header/open-redirect vector).
app.use((req, res, next) => {
  const host = (req.headers.host || '').split(':')[0].toLowerCase();
  const canonicalApex = (process.env.GOOGLE_REDIRECT_URI && new URL(process.env.GOOGLE_REDIRECT_URI).hostname)
    || (process.env.APP_URL && new URL(process.env.APP_URL).hostname)
    || (process.env.RAILWAY_PUBLIC_DOMAIN || '').replace(/^www\./, '');
  if (!canonicalApex || canonicalApex === 'localhost' || canonicalApex === '') return next();
  if (host === `www.${canonicalApex}`) {
    const target = new URL(req.originalUrl || '/', `https://${canonicalApex}`);
    return res.redirect(301, target.toString());
  }
  return next();
});


// ── Capture raw body for Stripe webhook AND Resend webhook BEFORE express.json ──────────
const rawBodyMiddleware = (req, res, next) => {
  const isStripeWebhook = (req.path === '/api/billing/webhook' || req.path === '/api/billing/webhook/debug') && req.method === 'POST';
  const isResendWebhook = req.path === '/api/webhooks/resend/reply' && req.method === 'POST';

  if (isStripeWebhook || isResendWebhook) {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      req.rawBody = Buffer.concat(chunks).toString('utf8');
      next();
    });
  } else {
    next();
  }
};
app.use(rawBodyMiddleware);

// ── Stripe Webhook (uses captured raw body) ────────────────────────────

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

// ── TEMP: Webhook catcher for debugging ────────────────────────────────
app.post('/api/billing/webhook/debug', (req, res) => {
  console.log('[DEBUG Webhook] Headers:', JSON.stringify(req.headers, null, 2));
  console.log('[DEBUG Webhook] Raw body:', req.rawBody);
  console.log('[DEBUG Webhook] Body:', req.body);
  res.json({ received: true, rawBodyLength: req.rawBody?.length });
});

app.post('/api/billing/webhook', async (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers['stripe-signature'];

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  if (!signature) {
    console.error('Missing stripe-signature header');
    return res.status(400).json({ error: 'Missing signature' });
  }

  const rawBody = req.rawBody;
  console.log('[Webhook Debug] Using rawBody for verification, length:', rawBody?.length);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    console.log('[Webhook Debug] Signature verified successfully');
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  const client = await getClient();
  try {
    await processBillingEvent(event, getStripe(), client);

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return res.status(500).json({ error: 'Webhook handler failed' });
  } finally {
    client.release();
  }
});

// ── Webhook Health Check (for cron monitoring) ───────────────────────

app.get('/api/billing/webhook/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


// ── Resend Webhook Handler (Inbound Email Replies) ─────────────────────

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;
const DISCORD_WEBHOOK = process.env.DISCORD_OPS_WEBHOOK;

/**
 * Verify Resend webhook signature
 * Resend uses HMAC-SHA256 with the webhook secret
 */
function verifyResendSignature(req, secret) {
  const signature = req.headers['resend-signature'];
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(req.rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Simple heuristic sentiment analysis
 */
function analyzeSentiment(subject, body) {
  const text = `${subject || ''} ${body || ''}`.toLowerCase();

  // Positive indicators
  const positiveKeywords = [
    'interested', 'tell me more', 'let\'s talk', 'demo', 'schedule',
    'meeting', 'call me', 'contact me', 'sounds good', 'great',
    'love this', 'excited', 'how much', 'pricing', 'trial',
    'sign up', 'get started', 'more info', 'details',
    'yes', 'please', 'would like', 'helpful', 'useful'
  ];

  // Negative indicators
  const negativeKeywords = [
    'not interested', 'unsubscribe', 'remove', 'stop', 'spam',
    'don\'t contact', 'no thanks', 'not a fit', 'busy',
    'don\'t have time', 'already using', 'competitor',
    'no budget', 'not now', 'go away', 'leave me alone'
  ];

  let positiveScore = 0;
  let negativeScore = 0;

  for (const kw of positiveKeywords) {
    if (text.includes(kw)) positiveScore++;
  }

  for (const kw of negativeKeywords) {
    if (text.includes(kw)) negativeScore++;
  }

  if (positiveScore > negativeScore && positiveScore > 0) return 'positive';
  if (negativeScore > positiveScore && negativeScore > 0) return 'negative';
  if (positiveScore > 0 || negativeScore > 0) return 'neutral';
  return 'unknown';
}

/**
 * Send Discord alert
 */
async function sendDiscordAlert(prospect, reply, sentiment) {
  if (!DISCORD_WEBHOOK) return;

  const colors = {
    positive: 0x22c55e,
    neutral: 0x3b82f6,
    negative: 0xf59e0b,
    unknown: 0x6b7280
  };

  const emojis = {
    positive: '✅',
    neutral: 'ℹ️',
    negative: '⚠️',
    unknown: '❓'
  };

  const embed = {
    title: `${emojis[sentiment]} New Reply: ${sentiment.toUpperCase()}`,
    description: `**From:** ${reply.from_email}\n**Subject:** ${reply.subject || '(no subject)'}\n**Sentiment:** ${sentiment}`,
    color: colors[sentiment],
    timestamp: new Date().toISOString(),
    fields: [
      { name: 'Preview', value: (reply.body || '').substring(0, 500), inline: false },
      ],
    footer: { text: 'HomeworkHelper Outreach' }
  };

  if (prospect) {
    embed.fields.unshift(
      { name: 'School', value: prospect.school, inline: true },
      { name: 'State', value: prospect.state, inline: true },
      { name: 'Grade', value: prospect.subject, inline: true }
    );
  }

  try {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (err) {
    console.error('Discord alert failed:', err.message);
  }
}

/**
 * Forward reply to monitoring emails
 */
async function forwardReplyToEmails(prospect, reply, sentiment) {
  const forwardEmails = [
    'ibcnu89@gmail.com',
    // Add your monitoring email here
  ];

  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set, skipping email forward');
    return;
  }

  const subject = `[${sentiment.toUpperCase()}] Reply: ${reply.subject || '(no subject)'}`;
  const html = `
    <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; color: #1a1a1a;">
      <h2>New Inbound Reply (${sentiment})</h2>
      <p><strong>From:</strong> ${reply.from_email}</p>
      <p><strong>Subject:</strong> ${reply.subject || '(no subject)'}</p>
      <p><strong>Sentiment:</strong> ${sentiment}</p>
      <p><strong>Received:</strong> ${new Date(reply.received_at).toLocaleString()}</p>
      ${prospect ? `
        <p><strong>School:</strong> ${prospect.school}</p>
        <p><strong>State:</strong> ${prospect.state}</p>
        <p><strong>Grade/Subject:</strong> ${prospect.subject}</p>
      ` : ''}
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <h3>Message Body:</h3>
      <pre style="background:#f5f5f5;padding:16px;border-radius:4px;white-space:pre-wrap;">${reply.body}</pre>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <p style="color:#888;font-size:12px">HomeworkHelper Outreach Webhook</p>
    </div>
  `;

  for (const email of forwardEmails) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'HomeworkHelper Replies <replies@letsmakeai.fun>',
          to: email,
          subject,
          html,
        }),
      });
      console.log(`Forwarded reply to ${email}`);
    } catch (err) {
      console.error(`Failed to forward to ${email}:`, err.message);
    }
  }
}

/**
 * Create follow-up task for positive replies
 */
async function createFollowup(prospectId, replyId) {
  const client = await getClient();
  try {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // 1 day after reply

    await client.query(`
      INSERT INTO outreach_followups (prospect_id, reply_id, due_date, status)
      VALUES ($1, $2, $3, 'pending')
    `, [prospectId, replyId, dueDate]);
  } finally {
    client.release();
  }
}

/**
 * Resend webhook handler for inbound email replies
 * Endpoint: /api/webhooks/resend/reply
 */
app.post('/api/webhooks/resend/reply', async (req, res) => {
  try {
    // Verify signature
    if (!RESEND_WEBHOOK_SECRET) {
      console.error('RESEND_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    if (!verifyResendSignature(req, RESEND_WEBHOOK_SECRET)) {
      console.warn('Invalid Resend webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse payload
    let payload;
    try {
      payload = JSON.parse(req.rawBody);
    } catch (e) {
      console.error('Invalid JSON:', e);
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    // Resend reply payload structure:
    // {
    //   "type": "email.received",
    //   "data": {
    //     "from": "sender@example.com",
    //     "to": ["skyler@letsmakeai.fun"],
    //     "subject": "Re: Your email",
    //     "text": "Reply body...",
    //     "html": "<p>Reply body...</p>",
    //     "message_id": "<msg-id@example.com>",
    //     "created_at": "2024-01-15T10:30:00Z"
    //   }
    // }

    if (payload.type !== 'email.received') {
      console.log('Ignoring non-reply event:', payload.type);
      return res.status(200).json({ received: true });
    }

    const email = payload.data;
    const fromEmail = email.from?.toLowerCase().trim();
    const subject = email.subject || '';
    const body = email.text || email.html || '';
    const receivedAt = email.created_at ? new Date(email.created_at) : new Date();
    const messageId = email.message_id || null;

    if (!fromEmail) {
      console.warn('Reply missing from address');
      return res.status(400).json({ error: 'Missing from address' });
    }

    const client = await getClient();
    try {
      // Match to prospect by email
      const prospectResult = await client.query(
        'SELECT id, school, state, subject FROM outreach_prospects WHERE LOWER(email) = $1',
        [fromEmail]
      );

      const prospect = prospectResult.rows[0] || null;

      // Analyze sentiment
      const sentiment = analyzeSentiment(subject, body);

      // Store reply
      const replyResult = await client.query(`
        INSERT INTO outreach_replies (
          prospect_id, from_email, subject, body, received_at,
          sentiment, reply_to_email_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        prospect?.id || null,
        fromEmail,
        subject,
        body,
        receivedAt,
        sentiment,
        messageId
      ]);

      const replyId = replyResult.rows[0].id;

      // If positive and matched to prospect, create follow-up
      if (sentiment === 'positive' && prospect) {
        await createFollowup(prospect.id, replyId);

        // Mark reply as having follow-up created
        await client.query(`
          UPDATE outreach_replies SET follow_up_created = TRUE WHERE id = $1
        `, [replyId]);
      }

      // Send Discord alert
      await sendDiscordAlert(prospect, { from_email: fromEmail, subject, body }, sentiment);

      // Forward to monitoring emails
      await forwardReplyToEmails(prospect, { from_email: fromEmail, subject, body, received_at: receivedAt }, sentiment);

      console.log(`Reply stored: ${replyId} | Sentiment: ${sentiment} | Prospect: ${prospect?.school || 'unmatched'}`);

      return res.status(200).json({ success: true, replyId, sentiment });

    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Resend webhook error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Health check for Resend webhook
app.get('/api/webhooks/resend/health', (req, res) => {
  res.json({ status: 'ok', service: 'resend-webhook', timestamp: new Date().toISOString() });
});

// ── Outreach Unsubscribe (cold-email compliance) ──────────────────────
// One-click unsubscribe for outreach emails. Marks prospect as unsubscribed
// so all future sequence steps (and the daily outreach batch) skip them.
app.get('/api/outreach/unsubscribe', async (req, res) => {
  try {
    const token = (req.query.token || '').toString();
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
      return res.status(400).send('Invalid unsubscribe token');
    }
    const result = await pool.query(
      `UPDATE outreach_prospects
         SET status = 'unsubscribed',
             updated_at = NOW()
       WHERE id = $1
       RETURNING email, school`,
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(404).send('Prospect not found');
    }
    // Also mark any active sequences as cancelled so they stop sending
    await pool.query(
      `UPDATE outreach_sequences
         SET status = 'cancelled',
             last_activity_at = NOW()
       WHERE prospect_id = $1 AND status = 'active'`,
      [token]
    );
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html><html><head><title>Unsubscribed</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>body{font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:80px auto;padding:24px;text-align:center;color:#1e293b}
      .ok{font-size:48px;margin-bottom:16px}h1{font-size:24px;margin:0 0 8px}p{color:#64748b;line-height:1.5}a{color:#4a85ff;text-decoration:none}</style>
      </head><body><div class="ok">✓</div><h1>You're unsubscribed</h1>
      <p>You won't receive any more outreach emails from HomeworkHelper. (${result.rows[0].email})</p>
      <p><a href="https://letsmakeai.fun">Return to letsmakeai.fun</a></p></body></html>`);
  } catch (e) {
    console.error('Unsubscribe error:', e.message);
    res.status(500).send('Internal error');
  }
});


// ── Body Parser ────────────────────────────────────────────────────────

app.use(express.json({ limit: '10mb' })); // support base64 image uploads

// ── Auth Routes (/api/auth/*) ────────────────────────────────────────

app.get('/api/auth/me', async (req, res) => {
  const accessToken = getCookie(req, 'access_token');
  if (!accessToken) return res.status(401).json({ error: 'Not authenticated' });

  const payload = verifyAccessToken(accessToken);
  if (!payload)
    return res
      .status(401)
      .json({ error: 'Token expired or invalid', code: 'TOKEN_EXPIRED' });

  return res.status(200).json({
    user: { id: payload.sub, email: payload.email, name: payload.name },
  });
});

app.get('/api/auth/google', async (req, res) => {
  if (!GOOGLE_CLIENT_ID)
    return res.status(500).json({ error: 'Google OAuth is not configured' });

  try {
    // Default to the app, not the hub landing page. Validate the
    // user-supplied hint immediately — only same-origin application
    // paths may ever be stored or honored (XSS/open-redirect guard).
    const appRedirect = safeAppRedirect(req.query.redirect) ?? '/apps/homeworkhelper';

    // Create opaque temp session ID and store state bound to it
    const tempSessionId = createTempSessionId(req);
    const { state } = await storeOAuthState({
      sessionId: tempSessionId,
      stateData: { redirect: appRedirect },
      provider: 'google'
    });
    // Set short-lived HttpOnly SameSite=Lax cookie with opaque session ID
    setTempSessionCookie(res, tempSessionId);

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
      state,
    });

    return res.redirect(
      302,
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    );
  } catch {
    clearTempSessionCookie(res);
    return res.status(500).json({ error: 'Unable to start Google sign-in' });
  }
});

app.get('/api/auth/google/callback', async (req, res) => {
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const { code, state, error: googleError } = req.query;
  // Always clear temp cookie on every callback outcome
  clearTempSessionCookie(res);

  // Helper: plain HTTP redirect. Cookies ride along as Set-Cookie headers and
  // are stored by the browser before the redirect is followed. No HTML
  // documents and no inline <script> are emitted from this route at all —
  // executable-JS interpolation is structurally impossible here.
  function httpRedirect(url) {
    return res.redirect(303, url);
  }

  // Consume state BEFORE any token exchange or provider data processing
  let stateData = null;
  try {
    const tempSessionId = getTempSessionCookie(req);
    stateData = state && tempSessionId
      ? await verifyAndConsumeOAuthState({ state, sessionId: tempSessionId, provider: 'google' })
      : null;
  } catch {
    // DB failure during state verification - do not proceed to token exchange
    return httpRedirect(`${FRONTEND_URL}/auth?auth_error=invalid_state`);
  }
  
  if (!stateData) return httpRedirect(`${FRONTEND_URL}/auth?auth_error=invalid_state`);
  if (googleError) {
    return httpRedirect(`${FRONTEND_URL}/?auth_error=access_denied`);
  }
  if (typeof code !== 'string' || !code)
    return res.status(400).json({ error: 'Missing authorization code' });
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET)
    return res.status(500).json({ error: 'Google OAuth is not configured' });

  try {
    // 1. Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokenText = await tokenResponse.text();
    if (!tokenResponse.ok) {
      // Do not log raw token response - fixed generic error
      return httpRedirect(`${FRONTEND_URL}/?auth_error=token_exchange_failed`);
    }

    let tokens;
    try {
      tokens = JSON.parse(tokenText);
    } catch {
      return httpRedirect(`${FRONTEND_URL}/?auth_error=token_exchange_failed`);
    }

    const { id_token } = tokens;
    if (!id_token)
      return httpRedirect(`${FRONTEND_URL}/?auth_error=no_id_token`);

    // 2. Decode ID token
    const idParts = id_token.split('.');
    if (idParts.length !== 3)
      return httpRedirect(`${FRONTEND_URL}/?auth_error=invalid_id_token`);

    const payload = JSON.parse(
      Buffer.from(
        idParts[1].replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
      ).toString('utf8')
    );

    const googleId = payload.sub;
    const email = payload.email?.toLowerCase();
    const name = payload.name || null;
    const avatarUrl = payload.picture || null;

    if (!googleId || !email)
      return httpRedirect(`${FRONTEND_URL}/?auth_error=missing_user_info`);

    // 3. Lookup or create user
    const client = await getClient();
    try {
      const existingGoogle = await client.query(
        'SELECT id, email, name, avatar_url FROM users WHERE google_id = $1',
        [googleId]
      );

      let user;
      if (existingGoogle.rows.length > 0) {
        user = existingGoogle.rows[0];
        if (avatarUrl && avatarUrl !== user.avatar_url) {
          await client.query(
            'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2',
            [avatarUrl, user.id]
          );
          user.avatar_url = avatarUrl;
        }
      } else {
        const existingEmail = await client.query(
          'SELECT id, google_id FROM users WHERE email = $1',
          [email]
        );

        if (existingEmail.rows.length > 0) {
          const existing = existingEmail.rows[0];
          if (existing.google_id) {
            return httpRedirect(`${FRONTEND_URL}/?auth_error=email_conflict`);
          }
          await client.query(
            'UPDATE users SET google_id = $1, email_verified = TRUE, avatar_url = COALESCE($2, avatar_url), name = COALESCE($3, name), updated_at = NOW() WHERE id = $4',
            [googleId, avatarUrl, name, existing.id]
          );
          user = {
            id: existing.id,
            email,
            name: name || null,
            avatar_url: avatarUrl,
          };
        } else {
          const { utm_source, utm_medium, utm_campaign } = readUtmFromRequest(req);
          const result = await client.query(
            `INSERT INTO users (email, google_id, name, avatar_url, email_verified, utm_source, utm_medium, utm_campaign)
             VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7)
             RETURNING id, email, name, avatar_url`,
            [email, googleId, name, avatarUrl, utm_source || null, utm_medium || null, utm_campaign || null]
          );
          user = result.rows[0];
        }
      }

      // 4. Create session + tokens
      const sessionResult = await client.query(
        `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, expires_at)
         VALUES ($1, 'pending', $2, NOW() + INTERVAL '7 days')
         RETURNING id`,
        [user.id, req.headers['user-agent'] || null]
      );
      const sessionId = sessionResult.rows[0].id;

      const accessToken = createAccessToken(user, sessionId);
      const refreshToken = createRefreshToken(user.id, sessionId);

      const tokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');
      await client.query(
        'UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2',
        [tokenHash, sessionId]
      );

      setAccessTokenCookie(res, accessToken);
      setRefreshTokenCookie(res, refreshToken);

      // 5. Redirect to the frontend. Cookies are Set-Cookie headers on this
      // response and are stored by the browser before it follows the 303
      // Location — no client-side script is needed (the old inline
      // window.location.replace template was an XSS injection point).
      const appRedirect = safeAppRedirect(stateData?.redirect) ?? '/';
      return res.redirect(303, `${FRONTEND_URL}${appRedirect}`);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Google callback failed');
    return res.redirect(303, `${FRONTEND_URL}/?auth_error=internal_error`);
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password, remember_me } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const emailTrimmed = email.trim().toLowerCase();
  const client = await getClient();
  try {
    const result = await client.query(
      'SELECT id, email, password_hash, name, avatar_url, created_at FROM users WHERE email = $1',
      [emailTrimmed]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.password_hash)
      return res
        .status(401)
        .json({
          error:
            'This account uses Google sign-in. Please log in with Google.',
        });

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Invalid email or password' });

    const sessionId = await makeSession(
      client,
      user.id,
      req.headers['user-agent']
    );
    const refreshToken = issueCookies(res, user, sessionId, !!remember_me);
    await storeRefreshHash(client, sessionId, refreshToken);

    return res.status(200).json({ user: userResponse(user) });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const emailTrimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed))
    return res.status(400).json({ error: 'Invalid email format' });

  const pwCheck = validatePasswordStrength(password);
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.message });

  const client = await getClient();
  try {
    const existing = await client.query(
      'SELECT id, google_id FROM users WHERE email = $1',
      [emailTrimmed]
    );
    if (existing.rows.length > 0) {
      const eu = existing.rows[0];
      if (eu.google_id) {
        return res.status(409).json({
          error:
            'This email is already registered via Google. Please sign in with Google instead.',
          code: 'google_linked',
        });
      }
      return res.status(409).json({
        error:
          'An account with this email already exists. Please sign in or reset your password.',
        code: 'email_exists',
      });
    }

    const passwordHash = await hashPassword(password);
    const { utm_source, utm_medium, utm_campaign } = readUtmFromRequest(req);
    const result = await client.query(
      `INSERT INTO users (email, password_hash, name, email_verified, utm_source, utm_medium, utm_campaign)
       VALUES ($1, $2, $3, FALSE, $4, $5, $6)
       RETURNING id, email, name, avatar_url, created_at`,
      [emailTrimmed, passwordHash, name?.trim() || null, utm_source || null, utm_medium || null, utm_campaign || null]
    );
    const user = result.rows[0];

    const sessionId = await makeSession(
      client,
      user.id,
      req.headers['user-agent']
    );
    const refreshToken = issueCookies(res, user, sessionId, false);
    await storeRefreshHash(client, sessionId, refreshToken);

    return res.status(201).json({ user: userResponse(user) });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/logout', async (req, res) => {
  clearAuthCookies(res);
  const refreshToken = getCookie(req, 'refresh_token');
  if (!refreshToken) return res.status(200).json({ success: true });

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) return res.status(200).json({ success: true });

  const client = await getClient();
  try {
    await client.query('DELETE FROM sessions WHERE id = $1', [
      payload.session_id,
    ]);
  } catch (error) {
    console.error('Logout session cleanup error:', error);
  } finally {
    client.release();
  }
  return res.status(200).json({ success: true });
});

app.post('/api/auth/refresh', async (req, res) => {
  const oldRefreshToken = getCookie(req, 'refresh_token');
  if (!oldRefreshToken)
    return res.status(401).json({ error: 'No refresh token' });

  const payload = verifyRefreshToken(oldRefreshToken);
  if (!payload) {
    clearAuthCookies(res);
    return res
      .status(401)
      .json({ error: 'Invalid or expired refresh token' });
  }

  const tokenHash = crypto
    .createHash('sha256')
    .update(oldRefreshToken)
    .digest('hex');
  const client = await getClient();

  try {
    const sessionResult = await client.query(
      `SELECT s.id, s.user_id, s.refresh_token_hash, s.expires_at, u.email, u.name
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [payload.session_id]
    );
    const session = sessionResult.rows[0];

    if (!session || session.refresh_token_hash !== tokenHash) {
      await client.query('DELETE FROM sessions WHERE user_id = $1', [
        payload.sub,
      ]);
      clearAuthCookies(res);
      return res
        .status(401)
        .json({ error: 'Session invalid — possible token replay' });
    }
    if (new Date(session.expires_at) < new Date()) {
      await client.query('DELETE FROM sessions WHERE id = $1', [
        session.id,
      ]);
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Session expired' });
    }

    await client.query('DELETE FROM sessions WHERE id = $1', [session.id]);
    const newSession = await client.query(
      `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, expires_at)
       VALUES ($1, 'pending', $2, NOW() + INTERVAL '7 days')
       RETURNING id`,
      [session.user_id, req.headers['user-agent'] || null]
    );
    const newSessionId = newSession.rows[0].id;

    const user = {
      id: session.user_id,
      email: session.email,
      name: session.name,
    };
    const newRefreshToken = issueCookies(res, user, newSessionId, false);
    const newHash = crypto
      .createHash('sha256')
      .update(newRefreshToken)
      .digest('hex');
    await client.query(
      'UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2',
      [newHash, newSessionId]
    );

    return res.status(200).json({
      user: { id: session.user_id, email: session.email, name: session.name },
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const result = await requestPasswordReset({ email });
    return res.status(200).json({ message: result.message });
  } catch {
    // Fixed generic error - no internal details exposed
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, email, new_password } = req.body || {};
  if (typeof token !== 'string' || !token || typeof email !== 'string' || !email.trim() || typeof new_password !== 'string' || !new_password)
    return res
      .status(400)
      .json({ error: 'Reset token, email, and new password are required' });

  const pwCheck = validatePasswordStrength(new_password);
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.message });

  try {
    const result = await completePasswordReset({ token, email, newPassword: new_password });
    if (!result.success) {
      return res.status(400).json({ error: result.message, code: result.error });
    }
    return res.status(200).json({ message: result.message });
  } catch {
    // Fixed generic error - no internal details exposed
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password)
    return res
      .status(400)
      .json({ error: 'Current password and new password are required' });
  if (current_password === new_password)
    return res
      .status(400)
      .json({ error: 'New password must be different from current password' });

  const pwCheck = validatePasswordStrength(new_password);
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.message });

  const client = await getClient();
  try {
    const result = await client.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [user.id]
    );
    const dbUser = result.rows[0];
    if (!dbUser) return res.status(404).json({ error: 'User not found' });
    if (!dbUser.password_hash) {
      return res.status(400).json({
        error:
          'This account uses Google sign-in and does not have a password. Set a password first via the reset flow.',
      });
    }

    const valid = await verifyPassword(current_password, dbUser.password_hash);
    if (!valid)
      return res
        .status(401)
        .json({ error: 'Current password is incorrect' });

    const newHash = await hashPassword(new_password);
    await client.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, user.id]
    );
    return res.status(200).json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/unlink-google', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const client = await getClient();
  try {
    const result = await client.query(
      'SELECT google_id, password_hash FROM users WHERE id = $1',
      [user.id]
    );
    const dbUser = result.rows[0];
    if (!dbUser) return res.status(404).json({ error: 'User not found' });
    if (!dbUser.google_id)
      return res
        .status(400)
        .json({ error: 'Your account is not linked to Google.' });
    if (!dbUser.password_hash) {
      return res.status(400).json({
        error:
          'Cannot unlink Google — you have no password set. Please set a password first in Account Settings, then unlink Google.',
      });
    }

    await client.query(
      'UPDATE users SET google_id = NULL, updated_at = NOW() WHERE id = $1',
      [user.id]
    );
    return res.status(200).json({
      message:
        'Google account unlinked. You can now only sign in with email/password.',
    });
  } catch (error) {
    console.error('Unlink Google error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});
// ── User Preferences Endpoints ──────────────────────────────────
// PATCH /api/user/preferences — Update user preferences (state, grade, subject)
app.patch('/api/user/preferences', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { state_code, grade_level, subject } = req.body || {};

  // Validate state_code if provided
  if (state_code !== undefined && state_code !== null && state_code !== '') {
    const validStates = [
      'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
      'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
      'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
      'VA','WA','WV','WI','WY'
    ];
    if (!validStates.includes(state_code.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid state code' });
    }
  }

  const client = await getClient();
  try {
    // Upsert preferences
    await client.query(
      `INSERT INTO user_preferences (user_id, state_code, grade_level, subject, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         state_code = COALESCE($2, user_preferences.state_code),
         grade_level = COALESCE($3, user_preferences.grade_level),
         subject = COALESCE($4, user_preferences.subject),
         updated_at = NOW()`,
      [user.id, state_code?.toUpperCase() || null, grade_level || null, subject || null]
    );

    // Return updated preferences
    const result = await client.query(
      'SELECT state_code, grade_level, subject FROM user_preferences WHERE user_id = $1',
      [user.id]
    );

    return res.status(200).json({ preferences: result.rows[0] || {} });
  } catch (error) {
    console.error('Update preferences error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/user/preferences — Get user preferences
app.get('/api/user/preferences', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const client = await getClient();
  try {
    const result = await client.query(
      'SELECT state_code, grade_level, subject FROM user_preferences WHERE user_id = $1',
      [user.id]
    );

    return res.status(200).json({ preferences: result.rows[0] || {} });
  } catch (error) {
    console.error('Get preferences error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/user/custom-subjects — Get user's custom subjects
app.get('/api/user/custom-subjects', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const client = await getClient();
  try {
    const result = await client.query(
      'SELECT subject_name, subject_code, created_at FROM user_custom_subjects WHERE user_id = $1 ORDER BY created_at',
      [user.id]
    );

    return res.status(200).json({ customSubjects: result.rows });
  } catch (error) {
    console.error('Get custom subjects error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/user/custom-subjects — Add a custom subject
app.post('/api/user/custom-subjects', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { subjectName } = req.body;
  if (!subjectName || typeof subjectName !== 'string') {
    return res.status(400).json({ error: 'subjectName is required' });
  }

  const trimmed = subjectName.trim();
  if (trimmed.length === 0 || trimmed.length > 100) {
    return res.status(400).json({ error: 'Subject name must be 1-100 characters' });
  }

  // Generate a URL-safe code from the subject name
  const subjectCode = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50);

  const client = await getClient();
  try {
    const result = await client.query(
      `INSERT INTO user_custom_subjects (user_id, subject_name, subject_code)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, subject_name) DO UPDATE SET subject_code = EXCLUDED.subject_code
       RETURNING subject_name, subject_code, created_at`,
      [user.id, trimmed, subjectCode]
    );

    return res.status(201).json({ customSubject: result.rows[0] });
  } catch (error) {
    console.error('Add custom subject error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// DELETE /api/user/custom-subjects/:subjectCode — Delete a custom subject
app.delete('/api/user/custom-subjects/:subjectCode', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { subjectCode } = req.params;

  const client = await getClient();
  try {
    const result = await client.query(
      'DELETE FROM user_custom_subjects WHERE user_id = $1 AND subject_code = $2 RETURNING subject_name',
      [user.id, subjectCode]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Custom subject not found' });
    }

    return res.status(200).json({ success: true, deleted: result.rows[0].subject_name });
  } catch (error) {
    console.error('Delete custom subject error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── Billing / Subscription Endpoints ──────────────────────────────────

// Register the unified billing handlers before legacy definitions below so
// checkout is single-plan-aware and status applies period-end entitlement.
app.post('/api/billing/create-checkout-session', checkoutHandler);
app.get('/api/billing/status', statusHandler);
app.get('/api/billing/plans', plansHandler);
app.get('/api/usage/ai', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  return res.json(await getUsageSummary(user.id));
});

// Unified routes keep checkout, status, and plan configuration consistent.
// POST /api/billing/portal-session — Open Stripe Billing Portal
app.post('/api/billing/portal-session', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-12-18.acacia',
  });

  const client = await getClient();
  try {
    const userResult = await client.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [user.id]
    );

    if (userResult.rowCount === 0 || !userResult.rows[0].stripe_customer_id) {
      return res.status(404).json({ error: 'No billing account found. Subscribe first.' });
    }

    const customerId = userResult.rows[0].stripe_customer_id;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      // FRONTEND_URL is apex-anchored (see derivation above) — raw APP_URL
      // could drift to www and split auth cookies across origins.
      return_url: `${FRONTEND_URL}/settings`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Create portal session error:', error);
    return res.status(500).json({ error: 'Failed to open billing portal' });
  } finally {
    client.release();
  }
});

// ── Grading Endpoints ─────────────────────────────────────────────────

app.post('/api/extract', requireSubscription, async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { imageBase64, mimeType, gradeLevel, subject, standardsText } =
    req.body;
  if (!imageBase64 || !mimeType || !gradeLevel || !subject) {
    return res.status(400).json({
      error:
        'Missing required fields: imageBase64, mimeType, gradeLevel, subject',
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    return res
      .status(500)
      .json({ error: 'Gemini API key not configured on server' });

  let prompt =
    "You are reading a child's handwritten homework. Grade level: " +
    gradeLevel +
    '. Subject: ' +
    subject +
    ".\n\nTranscribe every question and the child's handwritten answer exactly as written, preserving question numbers and structure. If an answer is blank, note it as [blank].\n\n";

  if (standardsText) {
    prompt +=
      'Use the following Illinois Learning Standards as your baseline reference when proposing correct answers and point values:\n' +
      standardsText +
      '\n\n';
  }

  prompt +=
    'Return ONLY a JSON array where each item has:\n{\n  "question_number": "string (e.g., \\"1\\", \\"2a\\", \\"Q3\\")",\n  "question_text": "string - the full question text as visible",\n  "student_answer": "string - exactly what the student wrote"\n}';

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

  try {
    const parts = [
      { text: prompt },
      { inline_data: { mime_type: mimeType, data: imageBase64 } },
    ];

    let response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    let usage = data.usageMetadata;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('Empty response from Gemini API');

    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
      // Retry once
      const retryParts = [
        { text: prompt + '\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation.' },
        parts[1],
      ];
      response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: retryParts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API retry error: ${response.status} - ${errText}`);
      }
      const retryData = await response.json();
      usage = retryData.usageMetadata;
      const retryText =
        retryData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!retryText)
        throw new Error('Empty response from Gemini API on retry');
      parsed = JSON.parse(
        retryText.replace(/```json\n?|\n?```/g, '').trim()
      );
    }

    if (!Array.isArray(parsed))
      throw new Error('Expected JSON array response from Gemini');

    await recordGeminiUsage({ userId: user.id, feature: 'handwriting_extraction', usage });

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Extract handwriting error:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/extract-rubric', requireSubscription, async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { imageBase64, mimeType } = req.body;
  if (!imageBase64 || !mimeType)
    return res
      .status(400)
      .json({ error: 'Missing required fields: imageBase64, mimeType' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    return res
      .status(500)
      .json({ error: 'Gemini API key not configured on server' });

  const prompt =
    "You are reading a teacher's answer key / rubric document. Transcribe it into a structured rubric.\n\nReturn ONLY a JSON array where each item has:\n{\n  \"question_number\": \"string (e.g., \\\"1\\\", \\\"2a\\\", \\\"Q3\\\")\",\n  \"correct_answer\": \"string - the correct answer or expected response\",\n  \"points_possible\": \"number - maximum points for this question\"\n}\n\nInclude all questions found. If points are not explicitly listed, estimate based on complexity (1-5 points typical).";

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

  try {
    const parts = [
      { text: prompt },
      { inline_data: { mime_type: mimeType, data: imageBase64 } },
    ];

    let response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    let usage = data.usageMetadata;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('Empty response from Gemini API');

    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
      const retryParts = [
        {
          text:
            prompt +
            '\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation.',
        },
        parts[1],
      ];
      response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: retryParts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(
          `Gemini API retry error: ${response.status} - ${errText}`
        );
      }
      const retryData = await response.json();
      usage = retryData.usageMetadata;
      const retryText =
        retryData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!retryText)
        throw new Error('Empty response from Gemini API on retry');
      parsed = JSON.parse(
        retryText.replace(/```json\n?|\n?```/g, '').trim()
      );
    }

    if (!Array.isArray(parsed))
      throw new Error('Expected JSON array response from Gemini');

    await recordGeminiUsage({ userId: user.id, feature: 'rubric_extraction', usage });

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Extract rubric error:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/grade', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  // Check active subscription before grading
  const client = await getClient();
  try {
    const userResult = await client.query(
      `SELECT
         subscription_status,
         stripe_subscription_status,
         stripe_current_period_end,
         stripe_trial_end
       FROM users WHERE id = $1`,
      [user.id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const u = userResult.rows[0];
    const status = u.subscription_status || u.stripe_subscription_status;
    const hasAccess = billingStatus(u).has_access;

    if (!hasAccess) {
      // Determine the specific reason for the lockout
      let reason = 'no_subscription';
      let message = 'An active subscription is required to use this feature.';

      if (status === 'canceled') {
        reason = 'canceled';
        message = 'Your subscription was canceled. Reactivate to continue grading.';
      } else if (status === 'past_due' || status === 'unpaid') {
        reason = 'payment_failed';
        message = 'Payment failed. Please update your payment method to continue.';
      } else if (status === 'no_subscription') {
        reason = 'no_subscription';
        message = 'Start your 7-day free trial to use HomeworkHelper.';
      }

      return res.status(402).json({
        error: message,
        code: reason,
        subscription_status: status,
      });
    }
  } catch (error) {
    console.error('Billing guard error:', error);
    return res.status(500).json({ error: 'Failed to verify subscription' });
  } finally {
    client.release();
  }

  const { extractedQuestions, rubric, standardsText, gradeLevel, subject } =
    req.body;

  if (!extractedQuestions || !gradeLevel || !subject)
    return res.status(400).json({
      error:
        'Missing required fields: extractedQuestions, gradeLevel, subject',
    });
  if (!Array.isArray(extractedQuestions))
    return res
      .status(400)
      .json({ error: 'extractedQuestions must be an array' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    return res
      .status(500)
      .json({ error: 'Gemini API key not configured on server' });

  const hasRubric =
    typeof rubric === 'string' && rubric.trim().length > 0;
  const rubricModeBlock = hasRubric
    ? buildAnswerKeyRubricInstructions()
    : buildAutoRubricInstructions(gradeLevel, subject, standardsText);
  const rubricSection = hasRubric
    ? `\nTeacher's answer key / rubric (authoritative):\n${rubric}\n`
    : `\nNo teacher answer key provided. ${standardsText ? 'Generate the rubric from the standards reference above.' : 'Generate the rubric from subject + grade-level norms.'}\n`;

  const prompt = `You are a kind, encouraging teacher. Grade level: ${gradeLevel}. Subject: ${subject}.\n\nStudent's answers (from OCR of handwritten homework):\n${JSON.stringify(extractedQuestions, null, 2)}\n${rubricSection}\n\n${rubricModeBlock}\n\n${getStrictnessGuidance(gradeLevel)}\n\nReturn ONLY a JSON object with this exact structure:\n{\n  "rubric_mode": "${hasRubric ? 'teacher_key' : 'auto_generated'}",\n  "questions": [\n    {\n      "question_number": "string",\n      "question_text": "string (echo the OCR'd question text verbatim)",\n      "student_answer": "string",\n      "correct_answer": "string",\n      "is_correct": true,\n      "points_earned": number,\n      "points_possible": number,\n      "feedback": "string - one encouraging sentence explaining what was right or what to work on"\n    }\n  ],\n  "overall": {\n    "total_points_earned": number,\n    "total_points_possible": number,\n    "letter_grade": "string (A+, A, A-, B+, B, B-, C+, C, C-, D, F)",\n    "encouragement_message": "string - warm, encouraging message for the student"\n  }\n}`;

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

  try {
    let response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    let usage = data.usageMetadata;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('Empty response from Gemini API');

    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
      const retryPrompt = `${prompt}\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation.`;
      response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: retryPrompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(
          `Gemini API retry error: ${response.status} - ${errText}`
        );
      }
      const retryData = await response.json();
      usage = retryData.usageMetadata;
      const retryText =
        retryData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!retryText)
        throw new Error('Empty response from Gemini API on retry');
      parsed = JSON.parse(
        retryText.replace(/```json\n?|\n?```/g, '').trim()
      );
    }

    if (
      !parsed.questions ||
      !Array.isArray(parsed.questions) ||
      !parsed.overall
    )
      throw new Error('Invalid response structure from Gemini API');

    await recordGeminiUsage({ userId: user.id, feature: 'grading', usage });

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Grade submission error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ── Batch Grading ───────────────────────────────────────────────────────

app.post('/api/batch-grade', upload.array('images', 50), requireSubscription, async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  // Check subscription access
  const client = await getClient();
  try {
    const userResult = await client.query(
      `SELECT subscription_status, stripe_subscription_status,
              stripe_current_period_end, stripe_trial_end
       FROM users WHERE id = $1`,
      [user.id]
    );
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const u = userResult.rows[0];
    const status = u.subscription_status || u.stripe_subscription_status;
    const hasAccess = billingStatus(u).has_access;
    if (!hasAccess) {
      return res.status(402).json({
        error: 'Active subscription required for batch grading',
        code: 'payment_required',
      });
    }
  } catch (error) {
    console.error('Batch grade billing guard error:', error);
    return res.status(500).json({ error: 'Failed to verify subscription' });
  } finally {
    client.release();
  }

  // Parse multipart form data (images + config)
  // Expected: images[] (files), gradeLevel, subject, rubric?, standardsText?
  const images = req.files;
  const { gradeLevel, subject, rubric, standardsText } = req.body;

  if (!images || images.length === 0) {
    return res.status(400).json({ error: 'No images provided' });
  }
  if (!gradeLevel || !subject) {
    return res.status(400).json({ error: 'Missing required fields: gradeLevel, subject' });
  }
  if (images.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 images per batch' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  // Create batch session in DB
  const batchClient = await getClient();
  let batchId;
  try {
    const batchResult = await batchClient.query(
      `INSERT INTO batch_grading_sessions (user_id, subject, grade_level, rubric, standards_text, total_images, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'processing')
       RETURNING id`,
      [user.id, subject, gradeLevel, rubric || null, standardsText || null, images.length]
    );
    batchId = batchResult.rows[0].id;
  } catch (error) {
    console.error('Batch session create error:', error);
    batchClient.release();
    return res.status(500).json({ error: 'Failed to create batch session' });
  } finally {
    batchClient.release();
  }

  // Process images sequentially (rate limit friendly)
  const results = [];
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const imageBase64 = image.buffer.toString('base64');
    const mimeType = image.mimetype || 'image/jpeg';

    // Step 1: Extract questions from handwriting
    const extractPrompt = `You are reading a child's handwritten homework. Grade level: ${gradeLevel}. Subject: ${subject}.\n\nTranscribe every question and the child's handwritten answer exactly as written, preserving question numbers and structure. If an answer is blank, note it as [blank].\n\n${standardsText ? `Use these Illinois Learning Standards as reference:\n${standardsText}\n\n` : ''}Return ONLY a JSON array where each item has:\n{\n  "question_number": "string (e.g., \"1\", \"2a\", \"Q3\")",\n  "question_text": "string - the full question text as visible",\n  "student_answer": "string - exactly what the student wrote"\n}`;

    let extractedQuestions;
    try {
      const extractResponse = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: extractPrompt },
            { inline_data: { mime_type: mimeType, data: imageBase64 } }
          ] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
        })
      });
      if (!extractResponse.ok) throw new Error(`Gemini extract failed: ${extractResponse.status}`);
      const extractData = await extractResponse.json();
      const extractText = extractData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      extractedQuestions = JSON.parse(extractText.replace(/```json\n?|\n?```/g, '').trim());
      await recordGeminiUsage({ userId: user.id, feature: 'batch_handwriting_extraction', usage: extractData.usageMetadata });
    } catch (err) {
      console.error(`Image ${i+1} extraction error:`, err);
      results.push({
        image_index: i,
        error: 'Failed to extract handwriting',
        details: err.message
      });
      continue;
    }

    // Step 2: Grade with rubric
    const gradePrompt = `You are an expert teacher grading ${gradeLevel} ${subject} homework.\n\n${rubric ? `Use this teacher-provided rubric:\n${rubric}\n\n` : ''}${standardsText ? `Align to these Illinois Learning Standards:\n${standardsText}\n\n` : ''}Student's work:\n${JSON.stringify(extractedQuestions, null, 2)}\n\nReturn ONLY JSON:\n{\n  "questions": [\n    {\n      "question_number": "string",\n      "is_correct": boolean,\n      "points_earned": number,\n      "points_possible": number,\n      "feedback": "string - constructive, specific feedback",\n      "standard_code": "string or null"\n    }\n  ],\n  "overall": {\n    "total_points_earned": number,\n    "total_points_possible": number,\n    "percentage": number,\n    "letter_grade": "string",\n    "summary_feedback": "string"\n  }\n}`;

    let gradeResult;
    try {
      const gradeResponse = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: gradePrompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
        })
      });
      if (!gradeResponse.ok) throw new Error(`Gemini grade failed: ${gradeResponse.status}`);
      const gradeData = await gradeResponse.json();
      const gradeText = gradeData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      gradeResult = JSON.parse(gradeText.replace(/```json\n?|\n?```/g, '').trim());
      await recordGeminiUsage({ userId: user.id, feature: 'batch_grading', usage: gradeData.usageMetadata });
    } catch (err) {
      console.error(`Image ${i+1} grading error:`, err);
      results.push({
        image_index: i,
        error: 'Failed to grade',
        details: err.message
      });
      continue;
    }

    // Save result
    const csvRow = {
      student_name: `Student ${i+1}`,
      score: gradeResult.overall.total_points_earned,
      percentage: gradeResult.overall.percentage,
      letter_grade: gradeResult.overall.letter_grade,
      standards: gradeResult.questions.map(q => q.standard_code).filter(Boolean).join('; '),
      feedback: gradeResult.overall.summary_feedback
    };

    results.push({
      image_index: i,
      extracted: extractedQuestions,
      graded: gradeResult,
      csv_row: csvRow
    });

    // Update batch progress
    await getClient().then(c => c.query(
      `UPDATE batch_grading_sessions SET completed_images = $1, processed_count = $1, results = $2 WHERE id = $3`,
      [i + 1, JSON.stringify(results), batchId]
    ).then(c => c.release()).catch(() => {}));
  }

  // Mark batch complete
  await getClient().then(c => c.query(
    `UPDATE batch_grading_sessions SET status = 'completed', completed_at = NOW() WHERE id = $1`,
    [batchId]
  ).then(c => c.release()).catch(() => {}));

  return res.status(200).json({
    batch_id: batchId,
    total: images.length,
    successful: results.filter(r => !r.error).length,
    failed: results.filter(r => r.error).length,
    results
  });
});

// ── Batch Grading: Status ───────────────────────────────────────────────
app.get('/api/batch-grade/status/:id', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const client = await getClient();
  try {
    const result = await client.query(
      `SELECT id, status, total_images, completed_images, error, created_at, updated_at
       FROM batch_grading_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Batch session not found' });
    }
    const session = result.rows[0];
    return res.status(200).json({
      batch_id: session.id,
      status: session.status,
      total_images: session.total_images,
      completed_images: session.completed_images,
      progress_pct: session.total_images > 0 ? Math.round((session.completed_images / session.total_images) * 100) : 0,
      error: session.error,
      created_at: session.created_at,
      updated_at: session.updated_at
    });
  } catch (error) {
    console.error('Batch status error:', error);
    return res.status(500).json({ error: 'Failed to fetch batch status' });
  } finally {
    client.release();
  }
});

// ── Batch Grading: Results ──────────────────────────────────────────────
app.get('/api/batch-grade/results/:id', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const client = await getClient();
  try {
    const result = await client.query(
      `SELECT id, status, total_images, completed_images, results, grade_level, subject, rubric, created_at, completed_at
       FROM batch_grading_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Batch session not found' });
    }
    const session = result.rows[0];
    return res.status(200).json({
      batch_id: session.id,
      status: session.status,
      total_images: session.total_images,
      completed_images: session.completed_images,
      grade_level: session.grade_level,
      subject: session.subject,
      rubric: session.rubric,
      results: session.results || [],
      created_at: session.created_at,
      completed_at: session.completed_at
    });
  } catch (error) {
    console.error('Batch results error:', error);
    return res.status(500).json({ error: 'Failed to fetch batch results' });
  } finally {
    client.release();
  }
});

// ── Batch Grading: Export CSV ───────────────────────────────────────────
app.get('/api/batch-grade/export/:id', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const client = await getClient();
  try {
    const result = await client.query(
      `SELECT results, grade_level, subject, created_at
       FROM batch_grading_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Batch session not found' });
    }
    const session = result.rows[0];
    const results = session.results || [];

    // Build CSV
    const headers = ['Student', 'Score', 'Percentage', 'Letter Grade', 'Standards', 'Feedback'];
    const rows = results
      .filter(r => r.csv_row)
      .map(r => [
        r.csv_row.student_name,
        r.csv_row.score,
        r.csv_row.percentage,
        r.csv_row.letter_grade,
        r.csv_row.standards,
        r.csv_row.feedback
      ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="batch-grade-${req.params.id}-${Date.now()}.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    console.error('Batch export error:', error);
    return res.status(500).json({ error: 'Failed to export batch results' });
  } finally {
    client.release();
  }
});

// ── Batch Grading: Override Single Result ───────────────────────────────
app.post('/api/batch-grade/override', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { batch_id, image_index, overrides } = req.body; // overrides: { points_earned, feedback, letter_grade, ... }
  if (!batch_id || image_index === undefined || !overrides) {
    return res.status(400).json({ error: 'Missing required fields: batch_id, image_index, overrides' });
  }

  const client = await getClient();
  try {
    const result = await client.query(
      `SELECT results FROM batch_grading_sessions WHERE id = $1 AND user_id = $2`,
      [batch_id, user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Batch session not found' });
    }

    const results = [...(result.rows[0].results || [])];
    if (!results[image_index]) {
      return res.status(404).json({ error: 'Image index not found in batch' });
    }

    // Apply overrides to the graded result
    const current = results[image_index];
    if (current.graded) {
      // Merge overrides into questions array
      if (overrides.questions) {
        current.graded.questions = current.graded.questions.map((q, qi) => ({
          ...q,
          ...(overrides.questions[qi] || {})
        }));
      }
      // Merge overall overrides
      if (overrides.overall) {
        current.graded.overall = { ...current.graded.overall, ...overrides.overall };
      }
      // Update CSV row
      current.csv_row = {
        ...current.csv_row,
        score: current.graded.overall.total_points_earned,
        percentage: current.graded.overall.percentage,
        letter_grade: current.graded.overall.letter_grade,
        feedback: current.graded.overall.summary_feedback
      };
    }

    await client.query(
      `UPDATE batch_grading_sessions SET results = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(results), batch_id]
    );

    return res.status(200).json({ success: true, result: results[image_index] });
  } catch (error) {
    console.error('Batch override error:', error);
    return res.status(500).json({ error: 'Failed to apply override' });
  } finally {
    client.release();
  }
});

app.post('/api/get-standard', (req, res) => {
  const { gradeLevel, subject, stateCode } = req.body;
  if (!gradeLevel || !subject)
    return res
      .status(400)
      .json({ error: 'Missing required fields: gradeLevel, subject' });

  // State code handling
  const stateCodeUpper = (stateCode || 'IL').toUpperCase();
  const validStates = {
    'IL': 'Illinois', 'CA': 'California', 'TX': 'Texas', 'FL': 'Florida',
    'VA': 'Virginia', 'NY': 'New York', 'PA': 'Pennsylvania', 'OH': 'Ohio',
    'GA': 'Georgia', 'NC': 'North Carolina', 'MI': 'Michigan'
  };
  const stateName = validStates[stateCodeUpper] || 'Illinois';

  // Check if state has specific standards (non-Common Core)
  const stateInfo = states[stateCodeUpper];
  const hasStateStandards = stateInfo && stateInfo.source !== 'commonCore';

  let data;
  let standardsSource;
  if (hasStateStandards && stateStandards[stateCodeUpper]) {
    // Use state-specific standards
    data = stateStandards[stateCodeUpper];
    standardsSource = 'state';
  } else {
    // Use Common Core standards
    data = commonCore;
    standardsSource = 'commonCore';
  }

  if (!data)
    return res
      .status(500)
      .json({ standardsText: null, error: 'Standards data not available' });

  const normGrade = normalizeGradeLevel(gradeLevel);
  const subjectData = data[subject];

  if (!subjectData)
    return res.status(200).json({
      standardsText: null,
      error: `Subject "${subject}" not found in ${standardsSource} standards data`,
    });

  const standards = subjectData[normGrade];
  if (!standards || standards.length === 0)
    return res.status(200).json({
      standardsText: null,
      error: `No standards found for ${subject} ${normGrade} (using ${stateName} ${standardsSource} standards)`,
    });

  const standardsText = formatStandardsText(stateName, subject, normGrade, standards);
  return res.status(200).json({
    standardsText,
    error: null,
    gradeLevel: normGrade,
    subject,
    stateCode: stateCodeUpper,
    stateName,
    standardsSource,
    count: standards.length,
  });
});


// GOOGLE CLASSROOM ROUTES
// ============================================================

// Connect - initiate OAuth flow
app.post('/api/classroom/connect', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    // Same-origin application paths only (XSS/open-redirect guard).
    const redirect = safeAppRedirect(req.body?.redirect) ?? '/classroom';

    // Store OAuth state with userId
    const sessionId = await getSessionIdFromRequest(req, verifyAccessToken);
    if (!sessionId) {
      return res.status(401).json({ error: 'No valid session for Classroom connection' });
    }

    const { state } = await storeOAuthState({
      sessionId,
      stateData: { userId, redirect },
      provider: 'classroom'
    });

    const authUrl = getClassroomAuthUrl({ redirect, userId, state });
    return res.json({ authUrl });
  } catch (error) {
    console.error('Classroom connect failed');
    return res.status(500).json({ error: 'Failed to initiate Classroom connection' });
  }
});

// Callback - handle OAuth return
app.get('/api/classroom/callback', async (req, res) => {
  const { code, state, error: googleError } = req.query;

  // Classroom callback is browser navigation - cookie (access_token) is available
  // Require session from access token AND valid state - reject missing/invalid
  let sessionId = null;
  let stateData = null;
  try {
    sessionId = await getSessionIdFromRequest(req, verifyAccessToken);
  } catch {
    // DB failure during session lookup
    return res.redirect(303, `${FRONTEND_URL}/settings?classroom_error=invalid_state`);
  }
  
  if (!sessionId) {
    return res.redirect(303, `${FRONTEND_URL}/settings?classroom_error=no_session`);
  }

  // Consume state BEFORE any token exchange
  try {
    stateData = state
      ? await verifyAndConsumeOAuthState({ state, sessionId, provider: 'classroom' })
      : null;
  } catch {
    // DB failure during state verification - do not proceed to token exchange
    return res.redirect(303, `${FRONTEND_URL}/settings?classroom_error=invalid_state`);
  }
  
  if (!stateData) return res.redirect(303, `${FRONTEND_URL}/settings?classroom_error=invalid_state`);
  if (googleError) {
    return res.redirect(303, `${FRONTEND_URL}/settings?classroom_error=access_denied`);
  }
  if (typeof code !== 'string' || !code)
    return res.status(400).json({ error: 'Missing authorization code' });

  // Use state data ONLY after verification - no fallback to unbound lookup
  const userId = stateData.userId;
  if (!userId) {
    return res.redirect(303, `${FRONTEND_URL}/settings?classroom_error=no_user_context`);
  }

  try {
    const tokens = await exchangeClassroomCode(code);
    await storeClassroomTokens(userId, tokens);

    // Redirect to frontend with success — validated same-origin path only.
    const appRedirect = safeAppRedirect(stateData?.redirect) ?? '/classroom';
    return res.redirect(303, `${FRONTEND_URL}${appRedirect}?classroom_connected=true`);
  } catch (error) {
    // Do not log raw provider error
    return res.redirect(303, `${FRONTEND_URL}/settings?classroom_error=callback_failed`);
  }
});

// Status - check connection
app.get('/api/classroom/status', requireAuth, async (req, res) => {
  try {
    const status = await getClassroomConnectionStatus(req.user.sub);
    return res.json(status);
  } catch (error) {
    console.error('Classroom status error:', error);
    return res.status(500).json({ error: 'Failed to get Classroom status' });
  }
});

// Disconnect - revoke tokens
app.delete('/api/classroom/disconnect', requireAuth, async (req, res) => {
  try {
    await revokeClassroomTokens(req.user.sub);
    return res.json({ success: true });
  } catch (error) {
    console.error('Classroom disconnect error:', error);
    return res.status(500).json({ error: 'Failed to disconnect Classroom' });
  }
});

// Sync - trigger full sync
app.post('/api/classroom/sync', requireAuth, async (req, res) => {
  try {
    const result = await syncUserClassroom(req.user.sub);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Classroom sync error:', error);
    return res.status(500).json({ error: error.message || 'Sync failed' });
  }
});

// Get courses
app.get('/api/classroom/courses', requireAuth, async (req, res) => {
  try {
    const client = await getClient();
    try {
      const result = await client.query(
        `SELECT id, gc_course_id, name, section, subject, room, course_state, alternate_link, guardian_enabled, calendar_id, synced_at
         FROM classroom_courses WHERE user_id = $1 ORDER BY name`,
        [req.user.sub]
      );
      return res.json({ courses: result.rows });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Classroom courses error:', error);
    return res.status(500).json({ error: 'Failed to get courses' });
  }
});

// Get assignments for a course
app.get('/api/classroom/courses/:courseId/assignments', requireAuth, async (req, res) => {
  try {
    const client = await getClient();
    try {
      // Verify course belongs to user
      const courseCheck = await client.query(
        'SELECT id FROM classroom_courses WHERE id = $1 AND user_id = $2',
        [req.params.courseId, req.user.sub]
      );
      if (courseCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const result = await client.query(
        `SELECT id, gc_coursework_id, title, description, state, alternate_link, creation_time, update_time, due_date, due_time, max_points, work_type, synced_at
         FROM classroom_assignments WHERE course_id = $1 ORDER BY creation_time DESC`,
        [req.params.courseId]
      );
      return res.json({ assignments: result.rows });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Classroom assignments error:', error);
    return res.status(500).json({ error: 'Failed to get assignments' });
  }
});

// Get submissions for an assignment
app.get('/api/classroom/assignments/:assignmentId/submissions', requireAuth, async (req, res) => {
  try {
    const client = await getClient();
    try {
      // Verify assignment belongs to user's course
      const assignmentCheck = await client.query(
        `SELECT a.id FROM classroom_assignments a
         JOIN classroom_courses c ON a.course_id = c.id
         WHERE a.id = $1 AND c.user_id = $2`,
        [req.params.assignmentId, req.user.sub]
      );
      if (assignmentCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      const result = await client.query(
        `SELECT id, gc_submission_id, gc_user_id, student_name, student_email, state, assigned_grade, draft_grade, late, creation_time, update_time, synced_at, grading_session_id
         FROM classroom_submissions WHERE assignment_id = $1 ORDER BY student_name`,
        [req.params.assignmentId]
      );
      return res.json({ submissions: result.rows });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Classroom submissions error:', error);
    return res.status(500).json({ error: 'Failed to get submissions' });
  }
});

// Grade a submission and push to Classroom
app.post('/api/classroom/submissions/:submissionId/grade', requireAuth, async (req, res) => {
  try {
    const client = await getClient();
    try {
      // Verify submission belongs to user
      const subCheck = await client.query(
        `SELECT cs.id FROM classroom_submissions cs
         JOIN classroom_assignments ca ON cs.assignment_id = ca.id
         JOIN classroom_courses cc ON ca.course_id = cc.id
         WHERE cs.id = $1 AND cc.user_id = $2`,
        [req.params.submissionId, req.user.sub]
      );
      if (subCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Submission not found' });
      }

      const { gradingResult } = req.body;
      if (!gradingResult) {
        return res.status(400).json({ error: 'gradingResult required' });
      }

      const result = await pushGradeToClassroom(req.user.sub, req.params.submissionId, gradingResult);
      return res.json({ success: true, ...result });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Classroom grade push error:', error);
    return res.status(500).json({ error: error.message || 'Grade push failed' });
  }
});

// Sync log for debugging
app.get('/api/classroom/sync-log', requireAuth, async (req, res) => {
  try {
    const client = await getClient();
    try {
      const result = await client.query(
        `SELECT id, sync_type, status, items_processed, items_created, items_updated, items_failed, error_message, started_at, completed_at
         FROM classroom_sync_log WHERE user_id = $1 ORDER BY started_at DESC LIMIT 50`,
        [req.user.sub]
      );
      return res.json({ logs: result.rows });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Classroom sync log error:', error);
    return res.status(500).json({ error: 'Failed to get sync log' });
  }
});

// ── Health check ──────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Static SPA — catch-all fallback to index.html ─────────────────────

const DIST_DIR = path.join(__dirname, 'dist');
app.use(express.static(DIST_DIR));

// Express 5: use app.use() for catch-all, not app.get('*')
app.use((req, res) => {
  // Only serve index.html for non-API routes that don't match static files
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// ── Startup ───────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT, 10) || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`HHproduction server running on port ${PORT}`);
  console.log(`Public URL: ${FRONTEND_URL}`);
  console.log(`Cookie domain: ${COOKIE_DOMAIN || '(none)'}`);
});
