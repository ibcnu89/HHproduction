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

  /**
   * Fetch current user from server (reads access_token cookie).
   */
  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  /**
   * On mount: check if we already have a session cookie.
   */
  useEffect(() => {
    fetchUser().finally(() => setLoading(false));
  }, [fetchUser]);

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
   * Sign in with Google via popup.
   * Opens /api/auth/google → Google consent → callback sets cookies.
   * Polls for cookie presence by calling /api/auth/me every 500ms.
   */
  const loginWithGoogle = useCallback(async () => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      '/api/auth/google',
      'google-login',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      throw new Error('Popup blocked. Please allow popups for this site.');
    }

    // Poll for session cookie until popup closes or we get a user
    return new Promise((resolve, reject) => {
      const poll = setInterval(async () => {
        if (popup.closed) {
          clearInterval(poll);
          // Popup closed — try one final /me fetch
          await fetchUser();
          // Check if we got a user
          try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            if (res.ok) {
              const data = await res.json();
              setUser(data.user || data);
              resolve();
            } else {
              reject(new Error('Google sign-in was cancelled or failed'));
            }
          } catch {
            reject(new Error('Google sign-in was cancelled or failed'));
          }
        }
      }, 500);

      // Safety timeout (2 minutes)
      setTimeout(() => {
        clearInterval(poll);
        if (!popup.closed) popup.close();
        reject(new Error('Google sign-in timed out'));
      }, 120000);
    });
  }, [fetchUser]);

  /**
   * Logout: clear server cookies + reset local state.
   */
  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {}); // fire-and-forget — clear state regardless
    setUser(null);
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

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout, refresh }}>
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