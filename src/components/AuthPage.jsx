import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * AuthPage — login / register forms with Google OAuth.
 *
 * Modes: 'login' (default) or 'register'.
 * Toggle between them with a link at the bottom.
 */

export default function AuthPage() {
  const { login, register, loginWithGoogle } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const isLogin = mode === 'login';

  const validate = () => {
    if (!email.trim()) return 'Email is required';
    if (!email.includes('@') || !email.includes('.')) return 'Please enter a valid email';
    if (!password) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!isLogin && !name.trim()) return 'Name is required';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      // Success — AuthContext will update `user` and the app will re-render.
      // No need to navigate — App.jsx handles showing/hiding based on `user`.
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-50 dark:bg-slate-900 px-4 transition-colors duration-200">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 items-center justify-center mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-primary-900 dark:text-primary-100">HomeworkHelper</h1>
          <p className="text-primary-500 dark:text-primary-400 mt-1">AI-powered homework grading for teachers</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-primary-100 dark:border-slate-700 transition-colors duration-200">
          {/* Tabs */}
          <div className="flex mb-6 border-b border-primary-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 ${
                isLogin
                  ? 'border-primary-500 text-primary-700 dark:text-primary-300'
                  : 'border-transparent text-primary-400 dark:text-primary-500 hover:text-primary-600 dark:hover:text-primary-400'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); }}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 ${
                !isLogin
                  ? 'border-primary-500 text-primary-700 dark:text-primary-300'
                  : 'border-transparent text-primary-400 dark:text-primary-500 hover:text-primary-600 dark:hover:text-primary-400'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-warm-50 dark:bg-warm-900/30 border border-warm-200 dark:border-warm-800 text-warm-700 dark:text-warm-300 text-sm flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label htmlFor="auth-name" className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
                  Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-primary-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100 transition-colors"
                  placeholder="Mrs. Johnson"
                  disabled={busy}
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-primary-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100 transition-colors"
                placeholder="you@school.edu"
                disabled={busy}
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-primary-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100 transition-colors"
                placeholder="••••••••"
                disabled={busy}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                minLength={8}
              />
              <p className="text-xs text-primary-400 dark:text-primary-500 mt-1">At least 8 characters</p>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 px-4 rounded-xl font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2
                bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 shadow-lg hover:shadow-xl
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {isLogin ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-primary-100 dark:bg-slate-700" />
            <span className="text-xs text-primary-400 dark:text-primary-500 font-medium">OR</span>
            <div className="flex-1 h-px bg-primary-100 dark:bg-slate-700" />
          </div>

          {/* Google Button */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="w-full py-3 px-4 rounded-xl font-semibold text-base transition-all duration-200 flex items-center justify-center gap-3
              bg-white dark:bg-slate-700 border-2 border-primary-200 dark:border-slate-600 text-primary-700 dark:text-primary-300
              hover:border-primary-300 dark:hover:border-slate-500 hover:bg-primary-50 dark:hover:bg-slate-600
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          {/* Toggle link */}
          <p className="text-center text-sm text-primary-500 dark:text-primary-400 mt-6">
            {isLogin ? (
              <>Don't have an account?{' '}
                <button type="button" onClick={() => { setMode('register'); setError(null); }} className="font-semibold text-primary-600 dark:text-primary-300 hover:underline">
                  Create one
                </button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button type="button" onClick={() => { setMode('login'); setError(null); }} className="font-semibold text-primary-600 dark:text-primary-300 hover:underline">
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}