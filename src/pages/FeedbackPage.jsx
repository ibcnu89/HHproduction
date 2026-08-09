import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const FEEDBACK_TYPES = [
  { value: 'bug', label: '🐛 Bug Report', description: 'Something is broken or not working correctly' },
  { value: 'feature', label: '✨ Feature Request', description: 'I have an idea for a new feature' },
  { value: 'improvement', label: '🔧 Improvement', description: 'Make an existing feature better' },
  { value: 'praise', label: '❤️ Praise', description: 'Something works really well — keep doing it!' },
  { value: 'question', label: '❓ Question', description: 'How do I do X? Where is Y?' },
];

const PRODUCTS = [
  { id: 'homeworkhelper', name: 'HomeworkHelper', icon: '📝' },
  { id: 'lessonplanner', name: 'LessonPlanner', icon: '📚' },
  { id: 'parentcomm', name: 'ParentComm', icon: '💬' },
  { id: 'general', name: 'General / Platform', icon: '🌐' },
];

export default function FeedbackPage() {
  const { user } = useAuth();
  const [type, setType] = useState('feature');
  const [product, setProduct] = useState('homeworkhelper');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [includeContext, setIncludeContext] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Please fill in both title and description');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const context = includeContext ? {
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        userId: user?.id,
      } : null;

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, product, title, description, email, context }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit feedback');

      setSubmitted(true);
      setTitle('');
      setDescription('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-primary-50 dark:bg-slate-950 flex items-center justify-center py-20 px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">Thanks for Your Feedback!</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Your {FEEDBACK_TYPES.find(t => t.value === type)?.label.toLowerCase()} has been submitted. We read every single one.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors"
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-slate-950 py-20">
      <HubHeader />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
            Help Us Build Better Tools
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Every feature, fix, and improvement starts here. Teachers like you shape what we build next.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <StatCard label="Submitted this month" value="247" icon="📬" />
          <StatCard label="Implemented" value="34" icon="✅" color="green" />
          <StatCard label="In progress" value="12" icon="🔨" color="amber" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl border border-primary-100 dark:border-slate-800 p-6 lg:p-8 shadow-sm">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Type Selector */}
          <fieldset className="mb-8">
            <legend className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">What type of feedback?</legend>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {FEEDBACK_TYPES.map(t => (
                <label
                  key={t.value}
                  className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    type === t.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-primary-100 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={t.value}
                    checked={type === t.value}
                    onChange={() => setType(t.value)}
                    className="sr-only"
                  />
                  <div className="flex flex-col items-center text-center">
                    <span className="text-2xl mb-2">{t.label.split(' ')[0]}</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.label.split(' ').slice(1).join(' ')}</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.description}</p>
                  </div>
                  {type === t.value && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Product Selector */}
          <fieldset className="mb-8">
            <legend className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Which product?</legend>
            <div className="flex flex-wrap gap-3">
              {PRODUCTS.map(p => (
                <label
                  key={p.id}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all cursor-pointer ${
                    product === p.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-primary-100 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="product"
                    value={p.id}
                    checked={product === p.id}
                    onChange={() => setProduct(p.id)}
                    className="sr-only"
                  />
                  <span className="text-lg">{p.icon}</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{p.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Title */}
          <div className="mb-6">
            <label htmlFor="title" className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Summarize your feedback in one line..."
              className="w-full px-4 py-3 rounded-xl border border-primary-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              required
              maxLength={100}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-right">{title.length}/100</p>
          </div>

          {/* Description */}
          <div className="mb-6">
            <label htmlFor="description" className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Details <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Tell us more... What happened? What did you expect? Any workarounds? Screenshots help too!"
              rows={6}
              className="w-full px-4 py-3 rounded-xl border border-primary-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-y"
              required
              maxLength={5000}
            ></textarea>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-right">{description.length}/5000</p>
          </div>

          {/* Email (optional) */}
          <div className="mb-6">
            <label htmlFor="email" className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Your Email (optional)
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="we'll only email if we have questions"
              className="w-full px-4 py-3 rounded-xl border border-primary-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">We never share your email. Only used to follow up on your feedback.</p>
          </div>

          {/* Context Toggle */}
          <div className="mb-8 flex items-center gap-3 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800">
            <input
              id="includeContext"
              type="checkbox"
              checked={includeContext}
              onChange={e => setIncludeContext(e.target.checked)}
              className="w-5 h-5 text-primary-500 border-primary-200 dark:border-primary-700 rounded focus:ring-primary-500"
            />
            <div>
              <label htmlFor="includeContext" className="font-medium text-slate-900 dark:text-slate-100">
                Include technical context
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Current page, browser, and account info (helps us reproduce bugs faster)
              </p>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 px-6 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white font-semibold text-lg rounded-xl transition-colors shadow-lg shadow-primary-500/25 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Submitting...
              </span>
            ) : (
              'Submit Feedback'
            )}
          </button>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-4">
            By submitting, you agree your feedback may be used to improve our products.{' '}
            <a href="/privacy" className="text-primary-500 hover:underline">Privacy Policy</a>
          </p>
        </form>

        {/* Recent Feedback Preview */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Recent Community Feedback</h2>
          <div className="space-y-4">
            {[
              { type: 'feature', product: 'HomeworkHelper', title: 'Add rubric sharing between teachers', votes: 23 },
              { type: 'bug', product: 'HomeworkHelper', title: 'OCR misses cursive lowercase "r" sometimes', votes: 12 },
              { type: 'improvement', product: 'General', title: 'Dark mode toggle in header', votes: 45 },
            ].map((item, i) => (
              <div key={i} className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-primary-100 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    item.type === 'bug' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                    item.type === 'feature' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' :
                    'bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-300'
                  }`}>
                    {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{item.title}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{item.product}</p>
                  </div>
                  <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                    {item.votes}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="bg-slate-50 dark:bg-slate-950 border-t border-primary-100 dark:border-slate-800 py-12 mt-20">
        <div className="max-w-3xl mx-auto px-4 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>Built with ❤️ for teachers. <a href="/donate" className="text-primary-500 hover:underline">Support our work</a> →</p>
        </div>
      </footer>
    </div>
  );
}

function HubHeader() {
  // Simplified inline header for this page
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-primary-100 dark:border-slate-800">
      <nav className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
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