import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

const navLinks = [
  { href: '/products', label: 'All Products', description: 'Browse our full toolkit' },
  { href: '/feedback', label: 'Feedback', description: 'Report bugs, request features' },
  { href: '/donate', label: 'Support Us', description: 'Keep tools affordable for teachers' },
];

export default function HubLanding() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-slate-950 transition-colors duration-200">
      {/* HubHeader rendered by parent */}

      <main className="pt-16">
        {/* ===== SECTION 1: HERO ===== */}
        <section className="relative overflow-hidden" aria-labelledby="hero-heading">
          {/* Background decoration */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-200/30 dark:bg-primary-900/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sage-200/30 dark:bg-sage-900/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-warm-200/30 dark:bg-warm-900/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
            <div className="text-center max-w-4xl mx-auto">
              {/* Umbrella Brand Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-300 text-sm font-medium mb-8 animate-fade-in">
                <span className="w-2 h-2 rounded-full bg-sage-500" />
                <span>HomeworkHelper by Let's Make AI</span>
              </div>

              {/* Headline */}
              <h1 id="hero-heading" className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-6 animate-slide-up">
                Grade handwritten homework in seconds, not hours
              </h1>

              {/* Subheadline */}
              <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 mb-10 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '100ms' }}>
                Snap a photo → get standards-aligned grades with personalized feedback. You stay in control of every score.
              </p>

              {/* Primary CTA */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
                {user ? (
                  <Link
                    to="/apps/homeworkhelper"
                    className="group w-full sm:w-auto px-8 py-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-lg rounded-xl transition-all shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30"
                  >
                    Open HomeworkHelper →
                  </Link>
                ) : (
                  <Link
                    to="/auth?mode=register"
                    className="group w-full sm:w-auto px-8 py-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-lg rounded-xl transition-all shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30"
                  >
                    Try HomeworkHelper Free →
                  </Link>
                )}
                <Link
                  to="/products"
                  className="w-full sm:w-auto px-8 py-4 border-2 border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 font-semibold text-lg rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all"
                >
                  View All Tools
                </Link>
              </div>

              {/* Trust Signal - Honest */}
              <p className="mt-8 text-sm text-slate-500 dark:text-slate-400 animate-fade-in" style={{ animationDelay: '300ms' }}>
                Free 7-day trial • No credit card required • Cancel anytime • Built for teachers, by teachers
              </p>
            </div>
          </div>
        </section>

        {/* ===== SECTION 2: PROBLEM / SOLUTION ===== */}
        <section className="py-20 lg:py-28 bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm" aria-labelledby="problem-heading">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 id="problem-heading" className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
                The grading problem every teacher knows
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-300">
                You became a teacher to teach — not to spend evenings and weekends buried in paper.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <ProblemCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                }
                title="Hours lost to grading"
                description="The average teacher spends 10+ hours per week grading. That's time not spent planning, connecting with students, or resting."
              />
              <ProblemCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
                title="Inconsistent feedback"
                description="Fatigue leads to rushed scoring. Students get checkmarks instead of actionable guidance on how to improve."
              />
              <ProblemCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                title="Standards alignment is manual"
                description="Mapping every question to state standards takes extra time most teachers don't have."
              />
              <ProblemCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                }
                title="No visibility for parents"
                description="Parents only see final grades — not the learning journey, growth areas, or how to help at home."
              />
            </div>

            {/* Solution pivot */}
            <div className="mt-16 text-center">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-sage-100 dark:bg-sage-900/30 rounded-2xl mb-6">
                <span className="w-3 h-3 rounded-full bg-sage-500" />
                <span className="text-sage-700 dark:text-sage-300 font-medium">HomeworkHelper solves all four</span>
              </div>
              <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
                One tool. Photo in → standards-aligned grades + personalized feedback out. You review, adjust, and approve every score.
              </p>
            </div>
          </div>
        </section>

        {/* ===== SECTION 3: HOW IT WORKS ===== */}
        <section className="py-20 lg:py-28" aria-labelledby="how-heading">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 id="how-heading" className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
                How it works — 3 steps, under 2 minutes
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-300">
                No complex setup. No training required. Works with the assignments you already give.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <StepCard
                number="1"
                title="Snap a photo"
                description="Photograph student work with your phone. Handwritten, typed, multi-page — HomeworkHelper reads it all."
                icon={
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              />
              <StepCard
                number="2"
                title="AI grades against your rubric"
                description="Standards-aligned scores + specific feedback per question. Supports Common Core, state standards, or your custom rubric."
                icon={
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l-2 2m0 0l2 2m-2-2h10" />
                  </svg>
                }
              />
              <StepCard
                number="3"
                title="You review, adjust, export"
                description="Every score is editable. Override anything. Export to CSV, Google Classroom, or print reports for students and parents."
                icon={
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                }
              />
            </div>
          </div>
        </section>

        {/* ===== SECTION 4: KEY CAPABILITIES ===== */}
        <section className="py-20 lg:py-28 bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm" aria-labelledby="features-heading">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 id="features-heading" className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
                Built for the realities of your classroom
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-300">
                Features teachers asked for, not features investors wanted.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: "Handwritten & typed work", desc: "Reads cursive, print, and typed text. Multi-page assignments supported.", icon: "✍️" },
                { title: "Standards-aligned grading", desc: "Common Core + 10 state standards built in. Maps every question automatically.", icon: "📐" },
                { title: "Custom rubrics from photos", desc: "Snap your rubric once → AI extracts criteria. Save and reuse across classes.", icon: "📋" },
                { title: "Batch grading", desc: "Grade 50 papers in one upload. Same consistency, fraction of the time.", icon: "📦" },
                { title: "CSV & Google Classroom export", desc: "One-click export to your gradebook. Sync scores directly to Classroom.", icon: "📤" },
                { title: "Student & parent reports", desc: "Printable reports show scores, feedback, and growth areas per student.", icon: "📊" },
                { title: "Multi-subject, multi-grade", desc: "K–12, all core subjects. Switch contexts in one click.", icon: "🔄" },
                { title: "Your data stays yours", desc: "No training on student work. FERPA-conscious. Delete anytime.", icon: "🔒" },
                { title: "Works on any device", desc: "Phone, tablet, laptop. No app install — runs in your browser.", icon: "📱" },
              ].map((feature, i) => (
                <FeatureCard key={i} feature={feature} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ===== SECTION 5: TEACHER CONTROL ===== */}
        <section className="py-20 lg:py-28" aria-labelledby="control-heading">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-3 px-6 py-3 bg-warm-100 dark:bg-warm-900/30 rounded-2xl mb-6 max-w-xs">
                  <span className="w-3 h-3 rounded-full bg-warm-500" />
                  <span className="text-warm-700 dark:text-warm-300 font-medium">You stay in control</span>
                </div>
                <h2 id="control-heading" className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-6">
                  AI proposes. You decide.
                </h2>
                <p className="text-lg text-slate-600 dark:text-slate-300 mb-8">
                  HomeworkHelper never auto-submits grades. Every score, every comment, every export goes through you first.
                </p>
                <ul className="space-y-4">
                  {[
                    "Review every question's score before finalizing",
                    "Override any grade with one click",
                    "Edit or rewrite AI feedback in your voice",
                    "Approve batch results individually or all at once",
                    "Export only what you've reviewed",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                      <svg className="w-5 h-5 text-sage-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative">
                <div className="aspect-video rounded-2xl bg-gradient-to-br from-primary-500/10 to-primary-600/10 border border-primary-200 dark:border-primary-800 flex items-center justify-center overflow-hidden">
                  <div className="text-center p-8">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <svg className="w-12 h-12 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-primary-700 dark:text-primary-300 text-lg font-medium">[App screenshot placeholder]</p>
                    <p className="text-sm text-primary-500 dark:text-primary-400 mt-2">Review → Adjust → Approve workflow</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== SECTION 6: HONEST SOCIAL PROOF ===== */}
        <section className="py-20 lg:py-28 bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm" aria-labelledby="proof-heading">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 id="proof-heading" className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
                Early teacher feedback
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-300">
                We're new. Here's what beta teachers have told us so far.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <TestimonialCard
                quote={`"First time I've ever finished grading before dinner. The feedback quality shocked me — it caught things I would've missed tired."`}
                author="Ms. Rodriguez"
                role="AP English, Grade 11"
                detail="~40 papers graded in trial"
              />
              <TestimonialCard
                quote={`"The rubric photo feature is genius. I snapped my department rubric once and now every essay maps to it automatically."`}
                author="Mr. Chen"
                role="History, Grade 10"
                detail="Custom rubric user since Week 2"
              />
              <TestimonialCard
                quote={`"Parents actually read the reports now. They see specific feedback, not just '85%'. Two parents emailed to thank me."`}
                author="Mrs. Thompson"
                role="Science, Grade 7"
                detail="Printable reports feature"
              />
            </div>

            <div className="mt-12 text-center">
              <p className="text-slate-500 dark:text-slate-400 mb-4">
                Want to be our next case study? We're looking for 10 teachers to document their first month.
              </p>
              <Link
                to="/feedback"
                className="inline-flex items-center gap-2 px-6 py-3 border-2 border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 font-semibold rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all"
              >
                Share Your Experience
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* ===== SECTION 7: CTA SECTION ===== */}
        <section className="py-20 lg:py-28 bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 relative overflow-hidden" aria-labelledby="cta-heading">
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          </div>

          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
            <h2 id="cta-heading" className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Ready to reclaim your evenings?
            </h2>
            <p className="text-lg text-primary-100 mb-8 max-w-xl mx-auto">
              Start your free 7-day trial. Grade your first stack of papers tonight. No credit card. No commitment.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {user ? (
                <Link
                  to="/apps/homeworkhelper"
                  className="group w-full sm:w-auto px-8 py-4 bg-white text-primary-600 font-semibold text-lg rounded-xl hover:bg-primary-50 transition-colors shadow-lg"
                >
                  Open HomeworkHelper →
                </Link>
              ) : (
                <Link
                  to="/auth?mode=register"
                  className="group w-full sm:w-auto px-8 py-4 bg-white text-primary-600 font-semibold text-lg rounded-xl hover:bg-primary-50 transition-colors shadow-lg"
                >
                  Try HomeworkHelper Free →
                </Link>
              )}
              <Link
                to="/products"
                className="w-full sm:w-auto px-8 py-4 border-2 border-white/30 text-white font-semibold text-lg rounded-xl hover:bg-white/10 transition-colors"
              >
                See All Tools
              </Link>
            </div>
            <p className="mt-6 text-sm text-primary-200">
              Free 7-day trial • No credit card • Cancel anytime • FERPA-conscious • Built by teachers
            </p>
          </div>
        </section>

        {/* ===== SECTION 8: FOOTER ===== */}
        <footer className="bg-slate-50 dark:bg-slate-950 border-t border-primary-100 dark:border-slate-800 py-16" role="contentinfo">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-4 gap-8 mb-12">
              <div className="md:col-span-2">
                <a href="/" className="flex items-center gap-3 mb-4" aria-label="letsmakeai.fun home">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <span className="text-xl font-bold text-primary-900 dark:text-primary-100">letsmakeai.fun</span>
                </a>
                <p className="text-slate-600 dark:text-slate-400 max-w-sm mb-6">
                  AI tools that give teachers their time back. HomeworkHelper is our first product — more coming.
                </p>
                <div className="flex gap-4">
                  <a href="https://twitter.com/ibcnu8989" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors" aria-label="Twitter">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/></svg>
                  </a>
                  <a href="https://github.com/ibcnu89" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors" aria-label="GitHub">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.305-.536-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
                  </a>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Products</h4>
                <nav aria-label="Product links">
                  <ul className="space-y-2">
                    <li><Link to="/apps/homeworkhelper" className="text-slate-600 dark:text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors text-sm">HomeworkHelper</Link></li>
                    <li><Link to="/apps/lessonplanner" className="text-slate-600 dark:text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors text-sm">LessonPlanner (Beta)</Link></li>
                    <li><Link to="/apps/parentcomm" className="text-slate-600 dark:text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors text-sm">ParentComm (Coming Soon)</Link></li>
                    <li><Link to="/products" className="text-slate-600 dark:text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors text-sm">All Products</Link></li>
                  </ul>
                </nav>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Resources</h4>
                <nav aria-label="Resource links">
                  <ul className="space-y-2">
                    {navLinks.map(l => (
                      <li key={l.href}><Link to={l.href} className="text-slate-600 dark:text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors text-sm">{l.label}</Link></li>
                    ))}
                    <li><Link to="/changelog" className="text-slate-600 dark:text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors text-sm">Changelog</Link></li>
                    <li><Link to="/auth" className="text-slate-600 dark:text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors text-sm">Sign In</Link></li>
                  </ul>
                </nav>
              </div>
            </div>
            <div className="pt-8 border-t border-primary-100 dark:border-slate-800">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  © {new Date().getFullYear()} letsmakeai.fun. Built for teachers, by teachers.
                </p>
                <div className="flex gap-6 text-sm">
                  <Link to="/privacy" className="text-slate-500 dark:text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors">Privacy</Link>
                  <Link to="/terms" className="text-slate-500 dark:text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors">Terms</Link>
                  <Link to="/feedback" className="text-slate-500 dark:text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors">Feedback</Link>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function ProblemCard({ icon, title, description }) {
  return (
    <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-primary-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-slate-700 transition-all duration-300 hover:shadow-lg">
      <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4 text-primary-600 dark:text-primary-400">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
      <p className="text-slate-600 dark:text-slate-300 text-sm">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description, icon }) {
  return (
    <div className="relative p-6 lg:p-8 bg-white dark:bg-slate-900 rounded-2xl border border-primary-100 dark:border-slate-800">
      <div className="absolute -top-3 left-6 w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-lg">
        {number}
      </div>
      <div className="pt-4">
        <div className="w-14 h-14 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-6 text-primary-600 dark:text-primary-400">
          {icon}
        </div>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">{title}</h3>
        <p className="text-slate-600 dark:text-slate-300">{description}</p>
      </div>
    </div>
  );
}

function FeatureCard({ feature, index }) {
  return (
    <div
      className="group p-6 bg-white dark:bg-slate-900 rounded-2xl border border-primary-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-slate-700 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/10 hover:-translate-y-1"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="text-4xl mb-4">{feature.icon}</div>
      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
        {feature.title}
      </h3>
      <p className="text-slate-600 dark:text-slate-300 text-sm">{feature.desc}</p>
    </div>
  );
}

function TestimonialCard({ quote, author, role, detail }) {
  return (
    <div className="p-6 lg:p-8 bg-white dark:bg-slate-900 rounded-2xl border border-primary-100 dark:border-slate-800">
      <div className="flex items-center gap-1 mb-4">
        <svg className="w-6 h-6 text-primary-300 dark:text-primary-700" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v7.391h-5.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v7.391h-5.983z"/>
        </svg>
        <svg className="w-6 h-6 text-primary-300 dark:text-primary-700" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v7.391h-5.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v7.391h-5.983z"/>
        </svg>
      </div>
      <blockquote className="text-slate-600 dark:text-slate-300 italic mb-6 leading-relaxed">
        {quote}
      </blockquote>
      <div className="border-t border-primary-100 dark:border-slate-800 pt-4">
        <div className="font-semibold text-slate-900 dark:text-slate-100">{author}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">{role}</div>
        <div className="text-xs text-primary-500 dark:text-primary-400 mt-1">{detail}</div>
      </div>
    </div>
  );
}