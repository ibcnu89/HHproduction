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
    features: ['Photo-based grading', 'Custom rubrics', 'Handwritten work support', 'Batch grading', 'CSV export', 'Google Classroom sync'],
    color: 'primary',
    gradient: 'from-primary-400 via-primary-500 to-primary-600',
    pricing: '$5.99/mo • 7-day free trial',
    screenshots: [],
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
    pricing: 'Free during beta',
    screenshots: [],
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
    pricing: 'Coming soon',
    screenshots: [],
  },
];

const statusColors = {
  live: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  beta: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  coming: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400',
};

const statusLabels = {
  live: 'Live',
  beta: 'Beta',
  coming: 'Coming Soon',
};

export default function ProductsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState('all');

  const filteredProducts = filter === 'all' ? products : products.filter(p => p.status === filter);

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-slate-950 py-20">
      <HubHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-2">
                All Products
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-300">
                Our growing toolkit of AI tools for teachers. Each solves a specific pain point.
              </p>
            </div>
            {/* Filter Tabs */}
            <div className="flex gap-2 bg-white dark:bg-slate-900 rounded-xl border border-primary-100 dark:border-slate-800 p-1">
              {['all', 'live', 'beta', 'coming'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    filter === f
                      ? 'bg-primary-500 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                  }`}
                >
                  {f === 'all' ? 'All' : statusLabels[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Products" value="3" icon="🛠️" />
            <StatCard label="Live" value="1" icon="✅" color="green" />
            <StatCard label="In Beta" value="1" icon="🔬" color="amber" />
            <StatCard label="Coming Soon" value="1" icon="🚀" color="primary" />
          </div>
        </div>

        {/* Product Grid */}
        <div className="space-y-8">
          {filteredProducts.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} user={user} />
          ))}
        </div>

        {/* Empty State */}
        {filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">No products match</h3>
            <p className="text-slate-500 dark:text-slate-400">Try a different filter</p>
          </div>
        )}

        {/* CTA Section */}
        <div className="mt-16 p-8 bg-gradient-to-r from-primary-500 via-primary-600 to-sage-500 rounded-2xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Have an Idea for a Tool?</h2>
          <p className="text-primary-100 mb-6 max-w-xl mx-auto">
            We build based on teacher feedback. Tell us what's missing from your workflow.
          </p>
          <Link
            to="/feedback"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary-600 font-semibold rounded-xl hover:bg-primary-50 transition-colors shadow-lg"
          >
            Submit a Feature Request
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </main>

      <footer className="bg-slate-50 dark:bg-slate-950 border-t border-primary-100 dark:border-slate-800 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>Built with ❤️ for teachers. <a href="/" className="text-primary-500 hover:underline">← Back to Hub</a></p>
        </div>
      </footer>
    </div>
  );
}

function HubHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-primary-100 dark:border-slate-800">
      <nav className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477 4.5 1.253" />
            </svg>
          </div>
          <span className="text-xl font-bold text-primary-900 dark:text-primary-100">letsmakeai.fun</span>
        </a>
        <a href="/" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">← Back to Hub</a>
      </nav>
    </header>
  );
}

function StatCard({ label, value, icon, color = 'primary' }) {
  const colors = {
    primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  };
  return (
    <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-primary-100 dark:border-slate-800 text-center">
      <span className="text-2xl mb-2 block">{icon}</span>
      <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</div>
    </div>
  );
}

function ProductCard({ product, index, user }) {
  return (
    <a
      href={product.href}
      className="group relative grid md:grid-cols-[300px_1fr] gap-8 p-6 lg:p-8 bg-white dark:bg-slate-900 rounded-2xl border border-primary-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-slate-700 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/10"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Left: Visual */}
      <div className="relative">
        {/* Status Badge */}
        <div className="absolute top-4 left-4 z-10">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[product.status]}`}>
            {product.status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
            {statusLabels[product.status]}
          </span>
        </div>

        {/* Icon Card */}
        <div
          className="aspect-square rounded-2xl flex items-center justify-center mb-6 group-hover:scale-[1.02] transition-transform duration-300"
          style={{ background: `linear-gradient(135deg, var(--color-${product.color}-400), var(--color-${product.color}-600))` }}
        >
          <span className="text-white text-6xl">{product.icon}</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6 text-center">
          <div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-xl">
            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{product.stats.teachers}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Teachers</div>
          </div>
          <div className="p-3 bg-sage-50 dark:bg-sage-900/30 rounded-xl">
            <div className="text-2xl font-bold text-sage-600 dark:text-sage-400">{product.stats.papers}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Papers</div>
          </div>
          <div className="p-3 bg-warm-50 dark:bg-warm-900/30 rounded-xl">
            <div className="text-2xl font-bold text-warm-600 dark:text-warm-400">{product.stats.timeSaved}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Time Saved</div>
          </div>
        </div>

        {/* Pricing */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{product.pricing}</span>
        </div>
      </div>

      {/* Right: Content */}
      <div className="flex flex-col justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            {product.name}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-4 text-sm font-medium">{product.tagline}</p>
          <p className="text-slate-600 dark:text-slate-300 mb-6 line-clamp-3">{product.description}</p>

          {/* Features */}
          <div className="space-y-2 mb-6">
            {product.features.map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0`}
                     style={{ background: `linear-gradient(135deg, var(--color-${product.color}-400), var(--color-${product.color}-600))` }}>
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                {feature}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="pt-4 border-t border-primary-100 dark:border-slate-800">
          {user && product.status === 'live' ? (
            <a
              href={product.href}
              className="w-full py-3 px-6 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-primary-500/25 inline-flex items-center justify-center gap-2"
            >
              Open Tool
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          ) : product.status === 'live' ? (
            <a
              href="/auth?mode=register"
              className="w-full py-3 px-6 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-primary-500/25 inline-flex items-center justify-center gap-2"
            >
              Start Free Trial
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          ) : product.status === 'beta' ? (
            <button className="w-full py-3 px-6 border-2 border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 font-semibold rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors inline-flex items-center justify-center gap-2">
              Join Beta Waitlist
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          ) : (
            <button className="w-full py-3 px-6 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold rounded-xl cursor-not-allowed inline-flex items-center justify-center gap-2">
              Notify Me
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </a>
  );
}
