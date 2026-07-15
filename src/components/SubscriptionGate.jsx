/**
 * SubscriptionGate — HOC/wrapper that blocks children unless user has active subscription/trial.
 * 
 * Usage:
 *   import { SubscriptionGate } from './components/SubscriptionGate';
 *   
 *   <SubscriptionGate>
 *     <TeacherInput ... />
 *   </SubscriptionGate>
 * 
 * Or with custom fallback:
 *   <SubscriptionGate fallback={<UpgradePrompt />}>
 *     <TeacherInput ... />
 *   </SubscriptionGate>
 */

import { useBilling } from '../contexts/BillingContext';

/**
 * Default fallback UI shown when user doesn't have access.
 * Shows pricing CTA matching the app's design.
 */
export function DefaultSubscriptionFallback({ showTrial = true }) {
  const { subscribe, loading: billingLoading } = useBilling();

  const handleSubscribe = async () => {
    try {
      await subscribe();
    } catch (err) {
      console.error('Subscribe failed:', err);
      // Error is handled by subscribe() - it opens Stripe checkout
    }
  };

  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
        Start Your 7-Day Free Trial
      </h2>
      <p className="text-gray-600 dark:text-gray-300 max-w-md mb-8 leading-relaxed">
        Full access to AI grading for all your classes. No charges for 7 days — 
        cancel anytime before the trial ends and you won't be billed.
      </p>

      {showTrial && (
        <ul className="text-left max-w-md mb-8 space-y-3 text-gray-700 dark:text-gray-300">
          <li className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>Unlimited AI grading — all subjects, all grade levels</span>
          </li>
          <li className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>Custom rubrics & standards alignment (IBSE, Common Core, etc.)</span>
          </li>
          <li className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>Handwriting OCR — just snap a photo of student work</span>
          </li>
          <li className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>Export grades to CSV / Google Classroom / LMS</span>
          </li>
          <li className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>FERPA/COPPA-conscious — we never sell student data</span>
          </li>
        </ul>
      )}

      <button
        onClick={handleSubscribe}
        disabled={billingLoading}
        className="w-full max-w-md py-4 px-8 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {billingLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Opening checkout...
          </span>
        ) : (
          'Start Free Trial → $20/mo after 7 days'
        )}
      </button>

      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        By starting your trial, you agree to our <a href="/terms" className="underline hover:text-amber-500">Terms of Service</a> and <a href="/privacy" className="underline hover:text-amber-500">Privacy Policy</a>.
      </p>
    </div>
  );
}

/**
 * SubscriptionGate — wrapper component that conditionally renders children
 * based on subscription status.
 * 
 * Props:
 *   children: ReactNode - content to show when user has access
 *   fallback: ReactNode - optional custom fallback (default: DefaultSubscriptionFallback)
 *   showTrial: boolean - whether fallback shows trial benefits (default: true)
 */
export function SubscriptionGate({ children, fallback, showTrial = true }) {
  const { hasAccess, loading } = useBilling();

  if (loading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full" />
          <p className="text-gray-600 dark:text-gray-400">Verifying subscription…</p>
        </div>
      </div>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  return fallback || <DefaultSubscriptionFallback showTrial={showTrial} />;
}

/**
 * TrialBadge — small indicator showing trial status
 * Use in headers or sidebars to show remaining trial days
 */
export function TrialBadge() {
  const { isTrialing, status } = useBilling();
  
  if (!isTrialing) return null;

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-800">
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
      </svg>
      <span>Trial: {status === 'trialing' ? 'active' : 'ending soon'}</span>
    </span>
  );
}