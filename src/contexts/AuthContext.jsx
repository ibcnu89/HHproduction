/**
 * AuthContext — provides user state and auth actions to the entire app.
 *
 * Exports:
 *   AuthProvider  — wrap <App /> in main.jsx
 *   useAuth()     — hook: { user, loading, login, register, logout, loginWithGoogle, refresh }
 *
 * Token storage: HTTP-only cookies (set by server, auto-sent by browser).
 * The frontend never reads tokens directly — it only reads /api/auth/me
 * to get the current user profile and checks HTTP response codes.
 *
 * Flow:
 *   1. On mount: GET /api/auth/me → user object or null
 *   2. login(email, pw): POST /api/auth/login → if 200, call GET /api/auth/me
 *   3. register(name, email, pw): POST /api/auth/register → if 200, call GET /api/auth/me
 *   4. loginWithGoogle(): opens /api/auth/google in a popup, polls for cookie
 *   5. logout(): POST /api/auth/logout → clear user state
 *   6. refreshToken(): POST /api/auth/refresh → new access token cookie (used by 401 interceptor)
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true until initial /me check completes
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(true);

  /**
   * Fetch current user from server (reads access_token cookie).
   */
  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || data);
        // Check onboarding status from user preferences
        if (data.user?.preferences?.onboarding_complete) {
          setOnboardingComplete(true);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setOnboardingLoading(false);
    }
  }, []);

  /**
   * On mount: check if we already have a session cookie.
   */
  useEffect(() => {
    fetchUser().finally(() => setLoading(false));
  }, [fetchUser]);

  /**
   * Mark onboarding as complete on the server.
   */
  const completeOnboarding = useCallback(async () => {
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_complete: true }),
      });
      if (res.ok) {
        setOnboardingComplete(true);
        return true;
      }
    } catch {
      // Fallback to localStorage if server fails
      localStorage.setItem('hh_onboarding_complete', 'true');
      setOnboardingComplete(true);
      return true;
    }
    return false;
  }, []);

  /**
   * Login with email/password.
   */
  const login = useCallback(async (email, password, rememberMe = false) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, remember_me: rememberMe }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }

    // Cookies are set — now fetch the user profile
    await fetchUser();
  }, [fetchUser]);

  /**
   * Register a new account.
   */
  const register = useCallback(async (name, email, password) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Registration failed');
    }

    await fetchUser();
  }, [fetchUser]);

  /**
   * Sign in with Google via full-page redirect (no popup).
   */
  const loginWithGoogle = useCallback(async () => {
    // Always redirect to the app after Google OAuth
    const redirectParam = encodeURIComponent('/apps/homeworkhelper');

    // Full-page redirect to the Google OAuth flow
    window.location.href = `/api/auth/google?redirect=${redirectParam}`;

    // Never resolves — the page unloads. The return from Google
    // triggers a fresh page load where AuthProvider picks up the session.
    return new Promise(() => {}); // hangs forever (intentional) — page will reload
  }, []);

  /**
   * Logout: clear server cookies + reset local state.
   */
  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {}); // fire-and-forget — clear state regardless
    setUser(null);
    setOnboardingComplete(false);
  }, []);

  /**
   * Refresh the access token (called when an API returns 401).
   * Returns true if refresh succeeded, false otherwise.
   */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  // Also check localStorage on mount for onboarding status (for faster perceived loading)
  useEffect(() => {
    const local = localStorage.getItem('hh_onboarding_complete');
    if (local === 'true') {
      setOnboardingComplete(true);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      onboardingComplete, 
      onboardingLoading,
      completeOnboarding,
      login, 
      register, 
      loginWithGoogle, 
      logout, 
      refresh 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth state and actions.
 * Must be called inside an <AuthProvider>.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be used inside <AuthProvider>');
  }
  return ctx;
}