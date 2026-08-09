/**
 * State Standards Data Sources - Manual Collection Guide
 * 
 * Since Firecrawl isn't available, here are the direct sources for each state's standards
 * We can use these URLs to manually collect or write a simple scraper
 */

const STANDARD_SOURCES = {
  // Non-Common Core States (9) - Need state-specific standard codes
  
  TX: {
    name: 'Texas',
    framework: 'TEKS',
    subjects: {
      Math: 'https://tea.texas.gov/academics/curriculum-standards/teks/texas-essential-knowledge-and-skills/mathematics-teks',
      ELA: 'https://tea.texas.gov/academics/curriculum-standards/teks/texas-essential-knowledge-and-skills/english-language-arts-and-reading-teks',
      Science: 'https://tea.texas.gov/academics/curriculum-standards/teks/texas-essential-knowledge-and-skills/science-teks',
      SocialStudies: 'https://tea.texas.gov/academics/curriculum-standards/teks/texas-essential-knowledge-and-skills/social-studies-teks'
    },
    notes: 'TEKS use format like "5.1.A", "5.2.B" - very detailed, grade-specific'
  },
  
  VA: {
    name: 'Virginia',
    framework: 'SOL',
    subjects: {
      Math: 'https://www.doe.virginia.gov/teaching-learning-assessment/k-12-standards-instruction/mathematics',
      ELA: 'https://www.doe.virginia.gov/teaching-learning-assessment/k-12-standards-instruction/english',
      Science: 'https://www.doe.virginia.gov/teaching-learning-assessment/k-12-standards-instruction/science',
      SocialStudies: 'https://www.doe.virginia.gov/teaching-learning-assessment/k-12-standards-instruction/history-social-science'
    },
    notes: 'SOL format: "5.1", "5.2" for standards, with sub-standards "5.1.a", "5.1.b"'
  },
  
  FL: {
    name: 'Florida',
    framework: 'B.E.S.T.',
    subjects: {
      Math: 'https://www.fldoe.org/academics/standards/subject-areas/math-science/math-b-e-s-t-standards.stml',
      ELA: 'https://www.fldoe.org/academics/standards/subject-areas/english-language-arts/fl-best-standards-english-language-arts.stml',
      Science: 'https://www.fldoe.org/academics/standards/subject-areas/math-science/science-b-e-s-t-standards.stml',
      SocialStudies: 'https://www.fldoe.org/academics/standards/subject-areas/social-studies/fl-best-standards-social-studies.stml'
    },
    notes: 'B.E.S.T. format: "MA.5.NSO.1.1", "ELA.5.R.1.1" - subject.grade.strand.standard'
  },
  
  MN: {
    name: 'Minnesota',
    framework: 'Minnesota K-12 Academic Standards',
    subjects: {
      Math: 'https://education.mn.gov/MDE/dse/stds/Math/',
      ELA: 'https://education.mn.gov/MDE/dse/stds/Reading/',
      Science: 'https://education.mn.gov/MDE/dse/stds/Science/',
      SocialStudies: 'https://education.mn.gov/MDE/dse/stds/Social/'
    },
    notes: 'Minnesota format: "5.1.1.1" (grade.strand.standard.benchmark)'
  },
  
  NE: {
    name: 'Nebraska',
    framework: 'Nebraska College and Career Ready Standards',
    subjects: {
      Math: 'https://www.education.ne.gov/math/',
      ELA: 'https://www.education.ne.gov/ela/',
      Science: 'https://www.education.ne.gov/science/',
      SocialStudies: 'https://www.education.ne.gov/socialstudies/'
    },
    notes: 'Nebraska format: "MA 5.1.1" - subject abbreviation + grade + standard'
  },
  
  OK: {
    name: 'Oklahoma',
    framework: 'Oklahoma Academic Standards',
    subjects: {
      Math: 'https://sde.ok.gov/oklahoma-academic-standards-mathematics',
      ELA: 'https://sde.ok.gov/oklahoma-academic-standards-english-language-arts',
      Science: 'https://sde.ok.gov/oklahoma-academic-standards-science',
      SocialStudies: 'https://sde.ok.gov/oklahoma-academic-standards-social-studies'
    },
    notes: 'OK format: "5.N.1.1", "5.R.1" - grade.subject.standard'
  },
  
  IN: {
    name: 'Indiana',
    framework: 'Indiana Academic Standards',
    subjects: {
      Math: 'https://www.in.gov/doe/students/indiana-academic-standards/mathematics/',
      ELA: 'https://www.in.gov/doe/students/indiana-academic-standards/english-language-arts/',
      Science: 'https://www.in.gov/doe/students/indiana-academic-standards/science/',
      SocialStudies: 'https://www.in.gov/doe/students/indiana-academic-standards/social-studies/'
    },
    notes: 'Indiana format: "5.NS.1", "5.RL.2.1" - grade.domain.standard'
  },
  
  SC: {
    name: 'South Carolina',
    framework: 'South Carolina College- and Career-Ready Standards',
    subjects: {
      Math: 'https://ed.sc.gov/instruction/standards-learning/mathematics/standards/',
      ELA: 'https://ed.sc.gov/instruction/standards-learning/english-language-arts/standards/',
      Science: 'https://ed.sc.gov/instruction/standards-learning/science/standards/',
      SocialStudies: 'https://ed.sc.gov/instruction/standards-learning/social-studies/standards/'
    },
    notes: 'SC format: "5.NSBT.1", "5.RL.1" - grade.strand.standard'
  }
};

// Common Core States (41) - Use same standard codes, just label with state name
// These states use the exact same standard codes as our existing Common Core data
// Just need to expand from 5th grade to all grades K-12

const COMMON_CORE_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'GA', 'HI',
  'ID', 'IL', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI',
  'MS', 'MO', 'MT', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND',
  'OH', 'OR', 'PA', 'RI', 'SD', 'TN', 'UT', 'VT', 'WA', 'WV',
  'WI', 'WY'
];

/**
 * Data Collection Plan:
 * 
 * Phase 1: Expand Common Core to all grades (K-12)
 * - We have 5th grade ELA + Math
 * - Need K-4, 6-12 for ELA, Math
 * - Add Science + Social Studies for all grades (use NGSS for Science, C3 for Social Studies)
 * 
 * Phase 2: Non-Common Core states (9 states)
 * - TX TEKS, VA SOL, FL B.E.S.T., MN, NE, OK, IN, SC
 * - These have different standard codes - need manual collection
 * 
 * Phase 3: Science + Social Studies for all states
 * - Common Core states: Use NGSS (Next Gen Science Standards) + C3 Framework
 * - Non-Common Core: Use state-specific
 */

export { STANDARD_SOURCES, COMMON_CORE_STATES };