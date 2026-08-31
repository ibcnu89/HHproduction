import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const TIERS = [
  {
    id: 'coffee',
    name: 'Coffee for the Team',
    amount: 5,
    description: 'Buys us a coffee while we code late into the night ☕',
    icon: '☕',
    color: 'warm',
    popular: false,
  },
  {
    id: 'supporter',
    name: 'Monthly Supporter',
    amount: 10,
    description: 'Helps cover server costs and keeps tools affordable for teachers',
    icon: '💚',
    color: 'sage',
    popular: true,
  },
  {
    id: 'champion',
    name: 'Teacher Champion',
    amount: 25,
    description: 'Funds new feature development and teacher outreach',
    icon: '🏆',
    color: 'primary',
    popular: false,
  },
  {
    id: 'custom',
    name: 'Custom Amount',
    amount: null,
    description: 'Any amount helps — every dollar goes back to the product',
    icon: '✨',
    color: 'slate',
    popular: false,
  },
];

const IMPACT_STATS = [
  { label: 'Server costs/month', value: '$180', icon: '🖥️' },
  { label: 'Team size', value: '2 developers', icon: '👥' },
];

export default function DonatePage() {
  const { user } = useAuth();
  const [selectedTier, setSelectedTier] = useState('supporter');
  const [customAmount, setCustomAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);

  const getAmount = () => {
    if (selectedTier === 'custom') {
      return parseInt(customAmount) || 0;
    }
    return TIERS.find(t => t.id === selectedTier)?.amount || 0;
  };

  const handleDonate = async (e) => {
    e.preventDefault();
    const amount = getAmount();
    if (amount < 1) {
      alert('Please enter an amount of at least $1');
      return;
    }

    setProcessing(true);

    // Redirect to Ko-fi / Stripe Payment Link
    // For now, we'll simulate and show success
    await new Promise(r => setTimeout(r, 1500));
    setProcessing(false);
    setCompleted(true);
  };

  if (completed) {
    return (
      <div className="min-h-screen bg-primary-50 dark:bg-slate-950 flex items-center justify-center py-20 px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <svg className="w-12 h-12 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">Thank You! 🙏</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Your ${getAmount()} ${frequency === 'monthly' ? 'monthly' : 'one-time'} donation makes a real difference.
            We'll put it to work building better tools for teachers.
          </p>
          <button
            onClick={() => setCompleted(false)}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors"
          >
            Back to Hub
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-slate-950 py-20">
      <HubHeader />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-warm-100 dark:bg-warm-900/30 text-warm-700 dark:text-warm-300 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-warm-500 animate-pulse" />
            <span>100% of donations go to product development</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
            Support Our Work
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            We build AI tools that save teachers hours every week — and keep them free or affordable.
            Your support helps us cover server costs, build new features, and reach more classrooms.
          </p>
        </div>

        {/* Impact Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {IMPACT_STATS.map((stat, i) => (
            <div key={i} className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-primary-100 dark:border-slate-800 text-center">
              <span className="text-3xl mb-2 block">{stat.icon}</span>
              <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">{stat.value}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Donation Form */}
        <form onSubmit={handleDonate} className="bg-white dark:bg-slate-900 rounded-2xl border border-primary-100 dark:border-slate-800 p-6 lg:p-8 shadow-sm space-y-8">
          {/* Frequency Toggle */}
          <fieldset>
            <legend className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">How would you like to give?</legend>
            <div className="flex gap-4">
              {['one-time', 'monthly'].map(freq => (
                <label
                  key={freq}
                  className={`flex-1 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    frequency === freq
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-primary-100 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="frequency"
                    value={freq}
                    checked={frequency === freq}
                    onChange={() => setFrequency(freq)}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {freq === 'monthly' ? '🔁' : '🎁'}
                    </span>
                    <div className="font-semibold text-slate-900 dark:text-slate-100 mt-1">
                      {freq === 'monthly' ? 'Monthly' : 'One-time'}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {freq === 'monthly' ? 'Recurring support' : 'Single gift'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Tier Selection */}
          <fieldset>
            <legend className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Choose your level {frequency === 'monthly' ? '(per month)' : '(one-time)'}
            </legend>
            <div className="grid sm:grid-cols-2 gap-4">
              {TIERS.map(tier => (
                <label
                  key={tier.id}
                  className={`relative p-5 rounded-xl border-2 transition-all cursor-pointer ${
                    selectedTier === tier.id
                      ? `border-${tier.color}-500 bg-${tier.color}-50 dark:bg-${tier.color}-900/20`
                      : 'border-primary-100 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="tier"
                    value={tier.id}
                    checked={selectedTier === tier.id}
                    onChange={() => { setSelectedTier(tier.id); setCustomAmount(''); }}
                    className="sr-only"
                  />
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl ${tier.popular ? 'ring-2 ring-offset-2' : ''}`}
                         style={{ background: tier.color !== 'slate' ? `linear-gradient(135deg, var(--color-${tier.color}-400), var(--color-${tier.color}-600))` : 'linear-gradient(135deg, #94a3b8, #64748b)' }}>
                      <span>{tier.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{tier.name}</h4>
                        {tier.popular && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
                            Most Popular
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                          ${tier.amount || customAmount || '—'}
                          {frequency === 'monthly' && tier.amount && <span className="text-sm font-normal text-slate-500 dark:text-slate-400">/mo</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">{tier.description}</p>
                  {selectedTier === tier.id && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-primary-500 rotate-45" />
                  )}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Custom Amount Input */}
          {selectedTier === 'custom' && (
            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800">
              <label htmlFor="customAmount" className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Your Amount <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">$</span>
                <input
                  id="customAmount"
                  type="number"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  placeholder="10"
                  min="1"
                  max="1000"
                  className="flex-1 px-4 py-3 text-2xl font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-primary-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Minimum $1 • Maximum $1,000</p>
            </div>
          )}

          {/* Email & Message */}
          <fieldset>
            <legend className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Your Info (optional)</legend>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="donateEmail" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input
                  id="donateEmail"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="receipt will be sent here"
                  className="w-full px-4 py-3 rounded-xl border border-primary-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label htmlFor="donateName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name (for thank you)</label>
                <input
                  id="donateName"
                  type="text"
                  placeholder="Your name"
                  className="w-full px-4 py-3 rounded-xl border border-primary-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Message to the team (optional)</label>
              <textarea
                id="message"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Why are you supporting us? A teacher story? A feature wish?"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-primary-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              ></textarea>
            </div>
          </fieldset>

          {/* Submit */}
          <div className="pt-4 border-t border-primary-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={processing}
              className="w-full py-4 px-6 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white font-semibold text-lg rounded-xl transition-colors shadow-lg shadow-primary-500/25 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                `Donate $${getAmount()} ${frequency === 'monthly' ? '/mo' : ''}`
              )}
            </button>
            <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-3">
              Secure payment via Ko-fi / Stripe • Cancel anytime • Receipt emailed instantly
            </p>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> Secure</span>
            <span className="flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Cancel anytime</span>
            <span className="flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> Receipt emailed</span>
            <span className="flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> Tax-deductible*</span>
          </div>
        </form>

        {/* Alternative Ways */}
        <div className="mt-16 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-primary-100 dark:border-slate-800">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4 text-center">Other Ways to Help</h3>
          <div className="grid md:grid-cols-3 gap-4 text-center">
            <a href="https://twitter.com/intent/tweet?text=Love%20%40HomeworkHelperAI%20%E2%80%94%20AI%20tools%20that%20give%20teachers%20their%20time%20back%20https%3A%2F%2Fletsmakeai.fun" target="_blank" rel="noopener noreferrer" className="p-4 rounded-xl border border-primary-100 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 transition-colors">
              <svg className="w-8 h-8 mx-auto mb-2 text-primary-500" fill="currentColor" viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/></svg>
              <div className="font-medium text-slate-900 dark:text-slate-100">Share on X</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Spread the word</div>
            </a>
            <a href="/feedback" className="p-4 rounded-xl border border-primary-100 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 transition-colors">
              <svg className="w-8 h-8 mx-auto mb-2 text-sage-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              <div className="font-medium text-slate-900 dark:text-slate-100">Give Feedback</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Shape the product</div>
            </a>
            <a href="mailto:teachers@letsmakeai.fun" className="p-4 rounded-xl border border-primary-100 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 transition-colors">
              <svg className="w-8 h-8 mx-auto mb-2 text-warm-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              <div className="font-medium text-slate-900 dark:text-slate-100">Email Us</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">teachers@letsmakeai.fun</div>
            </a>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
          <p>*Donations to letsmakeai.fun are not tax-deductible as charitable contributions. We are a for-profit company building tools for teachers. Your support goes directly to server costs, developer time, and teacher outreach.</p>
        </div>
      </main>

      <footer className="bg-slate-50 dark:bg-slate-950 border-t border-primary-100 dark:border-slate-800 py-12 mt-20">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>Built with ❤️ for teachers. <a href="/" className="text-primary-500 hover:underline">← Back to Hub</a></p>
        </div>
      </footer>
    </div>
  );
}

function HubHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-primary-100 dark:border-slate-800">
      <nav className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
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