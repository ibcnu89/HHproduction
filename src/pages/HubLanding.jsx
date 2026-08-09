import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

const products = [
  {
    id: 'homeworkhelper',
    name: 'HomeworkHelper',
    tagline: 'AI homework grading for teachers',
    description: 'Snap a photo of student work → get standards-aligned grades with personalized feedback in seconds. Supports custom rubrics, batch grading, and CSV export.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    href: '/apps/homeworkhelper',
    status: 'live',
    stats: { teachers: '2,400+', papers: '180K+', timeSaved: '80%' },
    features: ['OCR handwriting extraction', 'Illinois Learning Standards', 'Custom rubric builder', 'Batch grading (30 papers)', 'CSV gradebook export', 'Google Classroom sync'],
    color: 'primary',
    gradient: 'from-primary-400 via-primary-500 to-primary-600',
  },
  {
    id: 'lessonplanner',
    name: 'LessonPlanner',
    tagline: 'AI unit & lesson planning',
    description: 'Generate complete unit plans, daily lessons, and assessments aligned to your standards. Built for teachers who want to reclaim their Sundays.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    href: '/apps/lessonplanner',
    status: 'beta',
    stats: { teachers: '—', papers: '—', timeSaved: '—' },
    features: ['Standards-aligned units', 'Daily lesson breakdowns', 'Assessment generator', 'Differentiation suggestions', 'Export to LMS', 'Collaborative planning'],
    color: 'sage',
    gradient: 'from-sage-400 via-sage-500 to-sage-600',
  },
  {
    id: 'parentcomm',
    name: 'ParentComm',
    tagline: 'Automated parent communication',
    description: 'Turn grades and observations into personalized, professional parent messages. Choose tone, length, and frequency — we handle the writing.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    href: '/apps/parentcomm',
    status: 'coming',
    stats: { teachers: '—', papers: '—', timeSaved: '—' },
    features: ['Grade report narratives', 'Behavior observations', 'Conference prep notes', 'Multilingual support', 'Schedule & automate', 'FERPA compliant'],
    color: 'warm',
    gradient: 'from-warm-400 via-warm-500 to-warm-600',
  },
];

const trustSignals = [
  { label: 'Teachers served', value: '2,400+', icon: '👩‍🏫' },
  { label: 'Papers graded', value: '180K+', icon: '📄' },
  { label: 'Hours saved', value: '45K+', icon: '⏱️' },
  { label: 'Avg. time/paper', value: '12 sec', icon: '⚡' },
];

const navLinks = [
  { href: '/products', label: 'All Products', description: 'Browse our full suite of AI tools' },
  { href: '/feedback', label: 'Feedback', description: 'Report bugs, request features, share ideas' },
  { href: '/donate', label: 'Support Us', description: 'Help keep tools affordable for teachers' },
  { href: '/changelog', label: 'Changelog', description: 'See what\'s new across all products' },
];

export default function HubLanding() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-slate-950 transition-colors duration-200">
      {/* HubHeader will be rendered by parent */}

      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-200/30 dark:bg-primary-900/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sage-200/30 dark:bg-sage-900/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-warm-200/30 dark:bg-warm-900/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
            <div className="text-center max-w-4xl mx-auto">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-8 animate-fade-in">
                <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                <span>Back-to-School Launch: August 2026</span>
              </div>

              {/* Headline */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-6 animate-slide-up">
                AI tools that{' '}
                <span className="bg-gradient-to-r from-primary-500 via-primary-600 to-sage-500 bg-clip-text text-transparent">
                  give teachers their time back
                </span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 mb-10 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '100ms' }}>
                Handwritten homework graded in seconds. Lessons planned in minutes. Parents informed automatically.
                <br />Built by teachers, for teachers — no admin approval needed.
              </p>

              {/* Primary CTA */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
                {user ? (
                  <a
                    href="/apps/homeworkhelper"
                    className="group px-8 py-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-lg rounded-xl transition-all shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30"
                  >
                    Open HomeworkHelper →
                  </a>
                ) : (
                  <a
                    href="/auth?mode=register"
                    className="group px-8 py-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-lg rounded-xl transition-all shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30"
                  >
                    Start Free 7-Day Trial →
                  </a>
                )}
                <a
                  href="/products"
                  className="px-8 py-4 border-2 border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 font-semibold text-lg rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all"
                >
                  View All Tools
                </a>
              </div>

              {/* Trust Signals */}
              <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
                {trustSignals.map((stat, i) => (
                  <div
                    key={stat.label}
                    className="text-center p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-primary-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-slate-700 transition-colors"
                    style={{ animationDelay: `${300 + i * 50}ms` }}
                  >
                    <span className="text-3xl mb-2 block">{stat.icon}</span>
                    <div className="text-3xl sm:text-4xl font-bold text-primary-600 dark:text-primary-400">{stat.value}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Products Section */}
        <section className="py-20 lg:py-28 bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
                Our Toolkit
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-300">
                Each tool solves a specific teacher pain point. Use one, or use them all — they work together seamlessly.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
              {products.map((product, i) => (
                <ProductCard key={product.id} product={product} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* Navigation Hub Section */}
        <section className="py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
                More Ways to Engage
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-300">
                This platform grows with your feedback. Help us build what teachers actually need.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {navLinks.map((link, i) => (
                <NavCard key={link.href} link={link} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* Newsletter Signup */}
        <section className="py-20 lg:py-28 bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 relative overflow-hidden">
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          </div>

          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Stay in the Loop
            </h2>
            <p className="text-lg text-primary-100 mb-8 max-w-xl mx-auto">
              Weekly-ish emails with product updates, teacher tips, and early access to new tools. No spam, unsubscribe anytime.
            </p>
            <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto" onSubmit={(e) => { e.preventDefault(); alert('Thanks! Newsletter coming soon 📧'); }}>
              <input
                type="email"
                placeholder="your@school.edu"
                className="flex-1 px-6 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-primary-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all"
                required
              />
              <button
                type="submit"
                className="px-8 py-4 bg-white text-primary-600 font-semibold rounded-xl hover:bg-primary-50 transition-colors shadow-lg"
              >
                Subscribe
              </button>
            </form>
            <p className="mt-4 text-sm text-primary-200">🔒 We respect your inbox. Privacy policy • Unsubscribe anytime</p>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-slate-50 dark:bg-slate-950 border-t border-primary-100 dark:border-slate-800 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-4 gap-8 mb-12">
              <div className="md:col-span-2">
                <a href="/" className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <span className="text-xl font-bold text-primary-900 dark:text-primary-100">letsmakeai.fun</span>
                </a>
                <p className="text-slate-600 dark:text-slate-400 max-w-sm mb-6">
                  AI tools that give teachers their time back. Built with care for the humans shaping the future.
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
                <ul className="space-y-2">
                  {products.map(p => (
                    <li key={p.id}><a href={p.href} className="text-slate-600 dark:text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors text-sm">{p.name}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Resources</h4>
                <ul className="space-y-2">
                  {navLinks.map(l => (
                    <li key={l.href}><a href={l.href} className="text-slate-600 dark:text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors text-sm">{l.label}</a></li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="pt-8 border-t border-primary-100 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
              <p>© {new Date().getFullYear()} letsmakeai.fun. Built for teachers, by teachers.</p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function ProductCard({ product, index }) {
  const statusColors = {
    live: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    beta: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    coming: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400',
  };

  return (
    <a
      href={product.href}
      className="group relative p-6 lg:p-8 bg-white dark:bg-slate-900 rounded-2xl border border-primary-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-slate-700 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/10 hover:-translate-y-1"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Status Badge */}
      <div className="absolute top-4 right-4">
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[product.status]}`}>
          {product.status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
          {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
        </span>
      </div>

      {/* Icon */}
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300"
        style={{ background: `linear-gradient(135deg, var(--color-${product.color}-400), var(--color-${product.color}-600))` }}
      >
        <span className="text-white">{product.icon}</span>
      </div>

      {/* Content */}
      <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
        {product.name}
      </h3>
      <p className="text-slate-500 dark:text-slate-400 mb-4 text-sm font-medium">{product.tagline}</p>
      <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 line-clamp-3">{product.description}</p>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 mb-6 text-xs">
        <span className="px-2 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full">{product.stats.teachers}</span>
        <span className="px-2 py-1 bg-sage-50 dark:bg-sage-900/30 text-sage-600 dark:text-sage-400 rounded-full">{product.stats.papers}</span>
        <span className="px-2 py-1 bg-warm-50 dark:bg-warm-900/30 text-warm-600 dark:text-warm-400 rounded-full">{product.stats.timeSaved} saved</span>
      </div>

      {/* Features */}
      <ul className="space-y-2 mb-6">
        {product.features.slice(0, 4).map((feature, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
            <svg className="w-4 h-4 text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {feature}
          </li>
        ))}
        {product.features.length > 4 && (
          <li className="text-sm text-primary-500 dark:text-primary-400 font-medium">+{product.features.length - 4} more features</li>
        )}
      </ul>

      {/* CTA */}
      <span className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold group-hover:gap-3 transition-all">
        {product.status === 'live' ? 'Open Tool' : product.status === 'beta' ? 'Join Beta' : 'Notify Me'}
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </span>
    </a>
  );
}

function NavCard({ link, index }) {
  return (
    <a
      href={link.href}
      className="group p-6 bg-white dark:bg-slate-900 rounded-2xl border border-primary-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-slate-700 transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/10 hover:-translate-y-1"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4 group-hover:bg-primary-500 group-hover:text-white transition-colors">
        <svg className="w-6 h-6 text-primary-600 dark:text-primary-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          {link.href === '/products' && <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />}
          {link.href === '/feedback' && <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />}
          {link.href === '/donate' && <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0v6v0M15 11a4 4 0 110 5.292" />}
          {link.href === '/changelog' && <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />}
        </svg>
      </div>
      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{link.label}</h3>
      <p className="text-slate-600 dark:text-slate-400 text-sm">{link.description}</p>
      <span className="inline-flex items-center gap-1 mt-4 text-primary-600 dark:text-primary-400 font-medium text-sm group-hover:gap-2 transition-all">
        Explore
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </span>
    </a>
  );
}