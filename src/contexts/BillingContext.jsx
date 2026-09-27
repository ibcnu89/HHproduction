/**
 * BillingContext — provides subscription state and actions to the app.
 * 
 * Exports:
 *   BillingProvider  — wrap <App /> (or <AuthProvider>) in main.jsx
 *   useBilling()     — hook: { status, loading, error, hasAccess, isTrialing, subscribe, openPortal, refresh }
 * 
 * Data source: /api/billing/status (requires auth cookie)
 * Actions:
 *   - subscribe(): opens Stripe Checkout (creates session, redirects)
 *   - openPortal(): opens Stripe Billing Portal
 *   - refresh(): re-fetches status from server
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const BillingContext = createContext(null);

export function BillingProvider({ children }) {
  const [status, setStatus] = useState(null);
  const [hasSubscriptionAccess, setHasSubscriptionAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Derived states
  const hasAccess = hasSubscriptionAccess;
  const isTrialing = status === 'trialing';
  const isActive = status === 'active';
  const isCanceled = status === 'canceled';
  const isPastDue = status === 'past_due' || status === 'unpaid';
  const isNoSubscription = status === 'no_subscription' || !status;

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/status', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.subscription_status || data.status);
        setHasSubscriptionAccess(data.has_access === true);
        setError(null);
      } else if (res.status === 401) {
        // Not authenticated - will be handled by auth context
        setStatus('no_subscription');
        setHasSubscriptionAccess(false);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Failed to fetch subscription status');
      }
    } catch (err) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Subscribe: open Stripe Checkout
  const subscribe = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to start checkout');
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      setError(err.message);
      throw err; // Let caller handle if needed
    }
  }, []);

  // Open Stripe Billing Portal
  const openPortal = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/portal-session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to open billing portal');
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Refresh status (called after portal returns or webhook fires)
  const refresh = useCallback(async () => {
    await fetchStatus();
  }, [fetchStatus]);

  const value = {
    // State
    status,
    loading,
    error,
    // Derived
    hasAccess,
    isTrialing,
    isActive,
    isCanceled,
    isPastDue,
    isNoSubscription,
    // Actions
    subscribe,
    openPortal,
    refresh,
  };

  return (
    <BillingContext.Provider value={value}>
      {children}
    </BillingContext.Provider>
  );
}

/**
 * Hook to access billing state and actions.
 * Must be used within BillingProvider.
 */
export function useBilling() {
  const context = useContext(BillingContext);
  if (!context) {
    throw new Error('useBilling must be used within a BillingProvider');
  }
  return context;
}
