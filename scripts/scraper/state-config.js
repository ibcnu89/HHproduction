/**
 * State Standards Scraper
 * Scrapes academic standards from all 50 state DOE websites
 * 
 * Strategy:
 * 1. Common Core states: reuse same standard codes, just label with state name
 * 2. Non-Common Core states: scrape state-specific standards
 * 3. Output: JSON format matching our standards-embedded.js structure
 */

export const STATES = [
  // Common Core states (41) - use same standard codes
  { code: 'AL', name: 'Alabama', type: 'commonCore', doeUrl: 'https://www.alsde.edu/sec/sct/Pages/standards-all.aspx' },
  { code: 'AK', name: 'Alaska', type: 'commonCore', doeUrl: 'https://education.alaska.gov/akstandards' },
  { code: 'AZ', name: 'Arizona', type: 'commonCore', doeUrl: 'https://www.azed.gov/standards-practices/k-12standards' },
  { code: 'AR', name: 'Arkansas', type: 'commonCore', doeUrl: 'https://dese.ade.arkansas.gov/Offices/learning-services/curriculum-support' },
  { code: 'CA', name: 'California', type: 'commonCore', doeUrl: 'https://www.cde.ca.gov/be/st/ss/' },
  { code: 'CO', name: 'Colorado', type: 'commonCore', doeUrl: 'https://www.cde.state.co.us/standardsandinstruction' },
  { code: 'CT', name: 'Connecticut', type: 'commonCore', doeUrl: 'https://portal.ct.gov/SDE/Common-Core/Common-Core-State-Standards' },
  { code: 'DE', name: 'Delaware', type: 'commonCore', doeUrl: 'https://www.doe.k12.de.us/Page/3735' },
  { code: 'FL', name: 'Florida', type: 'nonCommonCore', doeUrl: 'https://www.fldoe.org/academics/standards/subject-areas/fl-best-standards.stml', framework: 'B.E.S.T.' },
  { code: 'GA', name: 'Georgia', type: 'commonCore', doeUrl: 'https://www.gadoe.org/Curriculum-Instruction-and-Assessment/Curriculum-and-Instruction/Pages/Georgia-Standards-of-Excellence.aspx' },
  { code: 'HI', name: 'Hawaii', type: 'commonCore', doeUrl: 'https://www.hawaiipublicschools.org/TeachingAndLearning/StudentLearning/Standards/Pages/default.aspx' },
  { code: 'ID', name: 'Idaho', type: 'commonCore', doeUrl: 'https://www.sde.idaho.gov/academic/standards/' },
  { code: 'IL', name: 'Illinois', type: 'commonCore', doeUrl: 'https://www.isbe.net/Pages/Learning-Standards.aspx' },
  { code: 'IN', name: 'Indiana', type: 'nonCommonCore', doeUrl: 'https://www.in.gov/doe/students/indiana-academic-standards/', framework: 'Indiana Academic Standards' },
  { code: 'IA', name: 'Iowa', type: 'commonCore', doeUrl: 'https://educateiowa.gov/iowa-core' },
  { code: 'KS', name: 'Kansas', type: 'commonCore', doeUrl: 'https://www.ksde.org/Agency/Division-of-Learning-Services/Career-Standards-and-Assessment-Services' },
  { code: 'KY', name: 'Kentucky', type: 'commonCore', doeUrl: 'https://education.ky.gov/curriculum/standards/Pages/default.aspx' },
  { code: 'LA', name: 'Louisiana', type: 'commonCore', doeUrl: 'https://www.louisianabelieves.com/resources/library/academic-standards' },
  { code: 'ME', name: 'Maine', type: 'commonCore', doeUrl: 'https://www.maine.gov/doe/learning/standards' },
  { code: 'MD', name: 'Maryland', type: 'commonCore', doeUrl: 'https://marylandpublicschools.org/about/Pages/DCAA/CCSS.aspx' },
  { code: 'MA', name: 'Massachusetts', type: 'commonCore', doeUrl: 'https://www.doe.mass.edu/frameworks/current.html' },
  { code: 'MI', name: 'Michigan', type: 'commonCore', doeUrl: 'https://www.michigan.gov/mde/services/academic-standards' },
  { code: 'MN', name: 'Minnesota', type: 'nonCommonCore', doeUrl: 'https://education.mn.gov/MDE/dse/stds/', framework: 'Minnesota K-12 Academic Standards' },
  { code: 'MS', name: 'Mississippi', type: 'commonCore', doeUrl: 'https://www.mdek12.org/EC/Standards' },
  { code: 'MO', name: 'Missouri', type: 'commonCore', doeUrl: 'https://dese.mo.gov/college-career-readiness/curriculum' },
  { code: 'MT', name: 'Montana', type: 'commonCore', doeUrl: 'https://opi.mt.gov/Educators/Teaching-Learning/K-12-Content-Standards' },
  { code: 'NE', name: 'Nebraska', type: 'nonCommonCore', doeUrl: 'https://www.education.ne.gov/contentareas/', framework: 'Nebraska College and Career Ready Standards' },
  { code: 'NV', name: 'Nevada', type: 'commonCore', doeUrl: 'https://doe.nv.gov/Standards_Instructional_Support/Nevada_Academic_Standards/' },
  { code: 'NH', name: 'New Hampshire', type: 'commonCore', doeUrl: 'https://www.education.nh.gov/who-we-are/division-of-learner-support/bureau-of-instructional-support/standards-and-assessments' },
  { code: 'NJ', name: 'New Jersey', type: 'commonCore', doeUrl: 'https://www.nj.gov/education/standards/' },
  { code: 'NM', name: 'New Mexico', type: 'commonCore', doeUrl: 'https://webnew.ped.state.nm.us/bureaus/literacy-humanities/standards/' },
  { code: 'NY', name: 'New York', type: 'commonCore', doeUrl: 'http://www.nysed.gov/curriculum-instruction/learning-standards' },
  { code: 'NC', name: 'North Carolina', type: 'commonCore', doeUrl: 'https://www.dpi.nc.gov/teach/north-carolina-standard-course-study' },
  { code: 'ND', name: 'North Dakota', type: 'commonCore', doeUrl: 'https://www.nd.gov/dpi/academic-support/academic-standards' },
  { code: 'OH', name: 'Ohio', type: 'commonCore', doeUrl: 'https://education.ohio.gov/Topics/Learning-in-Ohio/OLS-Graphic-Sections/Learning-Standards' },
  { code: 'OK', name: 'Oklahoma', type: 'nonCommonCore', doeUrl: 'https://sde.ok.gov/oklahoma-academic-standards', framework: 'Oklahoma Academic Standards' },
  { code: 'OR', name: 'Oregon', type: 'commonCore', doeUrl: 'https://www.oregon.gov/ode/educator-resources/standards/Pages/default.aspx' },
  { code: 'PA', name: 'Pennsylvania', type: 'commonCore', doeUrl: 'https://www.education.pa.gov/K-12/Curriculum/Standards/Pages/default.aspx' },
  { code: 'RI', name: 'Rhode Island', type: 'commonCore', doeUrl: 'https://www.ride.ri.gov/InstructionAssessment/Standards.aspx' },
  { code: 'SC', name: 'South Carolina', type: 'nonCommonCore', doeUrl: 'https://ed.sc.gov/instruction/standards-learning/', framework: 'South Carolina College- and Career-Ready Standards' },
  { code: 'SD', name: 'South Dakota', type: 'commonCore', doeUrl: 'https://doe.sd.gov/contentstandards/' },
  { code: 'TN', name: 'Tennessee', type: 'commonCore', doeUrl: 'https://www.tn.gov/education/academic-standards.html' },
  { code: 'TX', name: 'Texas', type: 'nonCommonCore', doeUrl: 'https://tea.texas.gov/academics/curriculum-standards/teks/texas-essential-knowledge-and-skills', framework: 'TEKS' },
  { code: 'UT', name: 'Utah', type: 'commonCore', doeUrl: 'https://www.schools.utah.gov/curr/standards' },
  { code: 'VT', name: 'Vermont', type: 'commonCore', doeUrl: 'https://education.vermont.gov/student-learning/content-areas' },
  { code: 'VA', name: 'Virginia', type: 'nonCommonCore', doeUrl: 'https://www.doe.virginia.gov/teaching-learning-assessment/k-12-standards-instruction', framework: 'SOL' },
  { code: 'WA', name: 'Washington', type: 'commonCore', doeUrl: 'https://www.k12.wa.us/student-success/learning-standards-instructional-materials' },
  { code: 'WV', name: 'West Virginia', type: 'commonCore', doeUrl: 'https://wvde.us/tree/college-career-readiness-standards/' },
  { code: 'WI', name: 'Wisconsin', type: 'commonCore', doeUrl: 'https://dpi.wi.gov/standards' },
  { code: 'WY', name: 'Wyoming', type: 'commonCore', doeUrl: 'https://edu.wyoming.gov/educators/standards/' }
];

export const SUBJECTS = ['ELA', 'Math', 'Science', 'SocialStudies'];
export const GRADES = ['K', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];