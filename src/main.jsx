import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import * as Sentry from '@sentry/react'
import { browserTracingIntegration, replayIntegration } from '@sentry/react'
import App from './App'
import './index.css'

// Initialize Sentry
function isValidSentryDsn(dsn) {
  if (!dsn) return false;
  if (dsn.includes('your-sentry-dsn') || dsn.includes('project-id')) return false;
  return /^https:\/\/[a-zA-Z0-9]+@[a-zA-Z0-9.-]+\/\d+$/.test(dsn);
}

if (isValidSentryDsn(import.meta.env.VITE_SENTRY_DSN)) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE || 'development',
    integrations: [
      browserTracingIntegration({
        // Set tracing origins to capture all API calls
        tracingOrigins: ['localhost', /^\//, 'https://letsmakeai.fun'],
      }),
      replayIntegration({
        // Capture 10% of all sessions
        sessionSampleRate: 0.1,
        // Capture 100% of sessions with errors
        errorSampleRate: 1.0,
        // Mask sensitive data
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',
    // Don't send events in development
    enabled: import.meta.env.PROD,
  });
  
  console.log('[Sentry] Frontend initialized');
} else {
  console.log('[Sentry] Frontend skipped (no valid DSN)');
}

// Error Boundary Component
class SentryErrorBoundary extends React.Component {
  state = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    
    // Send to Sentry
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
        ...errorInfo,
      },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-primary-50 dark:bg-slate-900 flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-warm-100 dark:bg-warm-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-warm-600 dark:text-warm-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-ink dark:text-paper mb-2">Something went wrong</h1>
            <p className="text-ink-muted dark:text-paper-muted mb-6">
              We've been notified and are looking into it. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors"
            >
              Refresh Page
            </button>
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-6 text-left p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
                <summary className="cursor-pointer text-warm-600 dark:text-warm-400">Error Details (Dev)</summary>
                <pre className="mt-2 whitespace-pre-wrap">{this.state.error.toString()}</pre>
                {this.state.errorInfo && (
                  <pre className="mt-2 whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                )}
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SentryErrorBoundary>
      <App />
      <Analytics />
    </SentryErrorBoundary>
  </React.StrictMode>,
);