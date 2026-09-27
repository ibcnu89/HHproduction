/**
 * BillingStatus — component showing current subscription status in settings/account pages.
 * Displays: status badge, trial days remaining, current period end, action buttons.
 */

import { useEffect, useState } from 'react';
import { useBilling } from '../contexts/BillingContext';

export function BillingStatus() {
  const [usage, setUsage] = useState(null);
  useEffect(() => {
    fetch('/api/usage/ai', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then(setUsage)
      .catch(() => {});
  }, []);
  const { 
    status, 
    loading, 
    error, 
    isTrialing, 
    isActive, 
    isCanceled, 
    isPastDue,
    subscribe, 
    openPortal, 
    refresh 
  } = useBilling();

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
        <p className="text-red-700 dark:text-red-300">Failed to load subscription: {error}</p>
        <button 
          onClick={refresh}
          className="mt-2 text-sm text-amber-600 dark:text-amber-400 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'trialing':
        return {
          label: 'Free Trial Active',
          color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
          ),
        };
      case 'active':
        return {
          label: 'Active Subscription',
          color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800',
          icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ),
        };
      case 'canceled':
        return {
          label: 'Canceled',
          color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
          icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          ),
        };
      case 'past_due':
      case 'unpaid':
        return {
          label: status === 'past_due' ? 'Payment Past Due' : 'Payment Failed',
          color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
          icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          ),
        };
      default:
        return {
          label: 'No Subscription',
          color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        };
    }
  };

  const config = getStatusConfig();

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className={`p-5 rounded-2xl border ${config.color}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${config.color.replace('text-', 'bg-').replace('border-', 'bg-opacity-20 ')}`}>
            {config.icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold">{config.label}</h3>
            <p className="text-sm opacity-80">
              {status === 'trialing' 
                ? '$5.99/month after trial ends'
                : status === 'active'
                ? '$5.99/month — renews automatically'
                : status === 'canceled'
                ? 'Access continues until end of billing period'
                : 'Update payment to restore access'}
            </p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {status === 'trialing' && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">Trial Ends</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {formatDate(document.querySelector('[data-trial-end]')?.dataset.trialEnd)}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
              Hard lock at trial end — no grace period
            </p>
          </div>
        )}

        {(status === 'active' || status === 'canceled') && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {status === 'canceled' ? 'Access Until' : 'Current Period Ends'}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatDate(document.querySelector('[data-period-end]')?.dataset.periodEnd)}
            </p>
          </div>
        )}

        {(status === 'past_due' || status === 'unpaid') && (
          <div className="md:col-span-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
              Payment failed — subscription will be canceled if not resolved
            </p>
            <p className="text-red-700 dark:text-red-400 text-sm">
              Update your payment method in the billing portal to restore access immediately.
            </p>
          </div>
        )}

        {status === 'no_subscription' && (
          <div className="md:col-span-2 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
              No active subscription
            </p>
            <p className="text-blue-700 dark:text-blue-400 text-sm">
              Start a 7-day free trial to unlock AI grading for all your classes.
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-2">
        {(status === 'trialing' || status === 'active') && (
          <button
            onClick={openPortal}
            disabled={loading}
            className="flex-1 min-w-[180px] py-3 px-5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Manage Subscription
          </button>
        )}

        {status === 'canceled' && (
          <button
            onClick={openPortal}
            disabled={loading}
            className="flex-1 min-w-[180px] py-3 px-5 bg-amber-500 text-white font-medium rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            Reactivate
          </button>
        )}

        {(status === 'no_subscription' || status === 'past_due' || status === 'unpaid') && (
          <button
            onClick={subscribe}
            disabled={loading}
            className="flex-1 min-w-[180px] py-3 px-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg disabled:opacity-50"
          >
            {loading ? 'Opening…' : status === 'past_due' || status === 'unpaid' ? 'Update Payment & Reactivate' : 'Start Free Trial'}
          </button>
        )}
      </div>

      {usage && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">AI usage this month</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {Number(usage.units).toLocaleString()} grading steps · {(Number(usage.input_tokens) + Number(usage.output_tokens)).toLocaleString()} tokens · estimated API cost ${Number(usage.estimated_cost_usd).toFixed(4)}
          </p>
        </div>
      )}

      {/* Legal footnote */}
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        By using HomeworkHelper, you agree to our{' '}
        <a href="/terms" className="underline hover:text-amber-500">Terms of Service</a>{' '}
        and{' '}
        <a href="/privacy" className="underline hover:text-amber-500">Privacy Policy</a>.
        Trial requires valid payment method. Cancel anytime before trial ends to avoid charges.
      </p>
    </div>
  );
}
