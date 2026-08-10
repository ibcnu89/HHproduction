import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBilling } from '../contexts/BillingContext';

/**
 * AccountSettings — slide-out panel for account management.
 * 
 * Sections:
 *  - Billing (subscription status + manage portal)
 *  - Change Password (current + new)
 *  - Unlink Google (if linked)
 *  - Danger Zone (delete account)
 */

function ChangePasswordForm({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!currentPassword) { setError('Current password is required'); return; }
    if (!newPassword || newPassword.length < 8) { setError('New password must be at least 8 characters'); return; }
    if (currentPassword === newPassword) { setError('New password must be different'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccess(true);
        setTimeout(onClose, 2000);
      } else {
        setError(data.error || 'Failed to change password');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally { setBusy(false); }
  };

  if (success) {
    return (
      <div className="text-center py-4">
        <svg className="w-10 h-10 mx-auto text-sage-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sage-700 dark:text-sage-300 text-sm font-medium">Password changed!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="p-2 rounded-lg bg-warm-50 dark:bg-warm-900/30 border border-warm-200 dark:border-warm-800 text-warm-700 dark:text-warm-300 text-xs flex items-start gap-1.5">
          <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-primary-700 dark:text-primary-300 mb-1">Current Password</label>
        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full px-3 py-2 border border-primary-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100 text-sm transition-colors"
          disabled={busy} autoComplete="current-password" />
      </div>
      <div>
        <label className="block text-xs font-medium text-primary-700 dark:text-primary-300 mb-1">New Password</label>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
          className="w-full px-3 py-2 border border-primary-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100 text-sm transition-colors"
          disabled={busy} autoComplete="new-password" />
        <p className="text-xs text-primary-400 dark:text-primary-500 mt-0.5">At least 8 characters</p>
      </div>
      <button type="submit" disabled={busy}
        className="w-full py-2 px-4 rounded-lg font-medium text-sm bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50">
        {busy ? 'Changing...' : 'Change Password'}
      </button>
    </form>
  );
}

function DeleteAccountForm({ onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!password) { setError('Password is required'); return; }
    if (confirmText !== 'DELETE') { setError('Please type "DELETE" to confirm'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/user/account', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          window.location.href = '/';
        }, 2000);
      } else {
        setError(data.error || 'Failed to delete account');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally { setBusy(false); }
  };

  if (success) {
    return (
      <div className="text-center py-4">
        <svg className="w-10 h-10 mx-auto text-warm-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-warm-700 dark:text-warm-300 text-sm font-medium">Account deleted</p>
        <p className="text-xs text-primary-400 dark:text-primary-500 mt-1">Redirecting to homepage...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="p-2 rounded-lg bg-warm-50 dark:bg-warm-900/30 border border-warm-200 dark:border-warm-800 text-warm-700 dark:text-warm-300 text-xs flex items-start gap-1.5">
          <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
      <p className="text-xs text-primary-500 dark:text-primary-400">
        This will permanently delete your account and all data including:
      </p>
      <ul className="text-xs text-primary-400 dark:text-primary-500 list-disc list-inside space-y-1 ml-2">
        <li>All grading sessions and results</li>
        <li>Subscription and billing history</li>
        <li>Google Classroom connections and sync data</li>
        <li>Custom subjects and preferences</li>
      </ul>
      <p className="text-xs text-warm-600 dark:text-warm-400 font-medium">
        This action cannot be undone.
      </p>
      <div>
        <label className="block text-xs font-medium text-primary-700 dark:text-primary-300 mb-1">Type "DELETE" to confirm</label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="w-full px-3 py-2 border border-primary-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100 text-sm transition-colors"
          disabled={busy}
          autoComplete="off"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-primary-700 dark:text-primary-300 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border border-primary-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white dark:bg-slate-700 text-primary-900 dark:text-primary-100 text-sm transition-colors"
          disabled={busy}
          autoComplete="current-password"
        />
      </div>
      <button type="submit" disabled={busy}
        className="w-full py-2 px-4 rounded-lg font-medium text-sm bg-warm-500 text-white hover:bg-warm-600 transition-colors disabled:opacity-50 border border-warm-600">
        {busy ? 'Deleting...' : 'Delete My Account'}
      </button>
    </form>
  );
}

function UnlinkGoogleButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleUnlink = async () => {
    if (!window.confirm('Are you sure? After unlinking, you can only sign in with email/password.')) return;
    setError(null); setBusy(true);
    try {
      const res = await fetch('/api/auth/unlink-google', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || 'Failed to unlink');
      }
    } catch {
      setError('Network error');
    } finally { setBusy(false); }
  };

  if (success) {
    return <p className="text-xs text-sage-600 dark:text-sage-400 font-medium">✓ Google account unlinked</p>;
  }

  return (
    <div>
      {error && <p className="text-xs text-warm-600 dark:text-warm-400 mb-2">{error}</p>}
      <button onClick={handleUnlink} disabled={busy}
        className="text-sm py-2 px-4 rounded-lg border border-warm-300 dark:border-warm-700 text-warm-700 dark:text-warm-300 hover:bg-warm-50 dark:hover:bg-warm-900/30 transition-colors disabled:opacity-50">
        {busy ? 'Unlinking...' : 'Unlink Google Account'}
      </button>
    </div>
  );
}

export default function AccountSettings({ onClose }) {
  const { user } = useAuth();
  const { status, isTrialing, isActive, isCanceled, isPastDue, openPortal, subscribe } = useBilling();

  const getStatusBadge = () => {
    switch (status) {
      case 'trialing': return { label: 'Trial Active', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' };
      case 'active': return { label: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' };
      case 'canceled': return { label: 'Canceled', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
      case 'past_due': return { label: 'Past Due', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
      default: return { label: 'No Plan', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
    }
  };

  const badge = getStatusBadge();

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      tabIndex={0}
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/30 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-labelledby="account-settings-title"
    >
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full bg-white dark:bg-slate-800 shadow-2xl flex flex-col transition-colors duration-200 animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-primary-100 dark:border-slate-700">
          <h2 id="account-settings-title" className="text-xl font-semibold text-primary-900 dark:text-primary-100">Account Settings</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-primary-500 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-100 dark:hover:bg-slate-700 transition-colors" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Profile Section */}
          <div>
            <h3 className="text-sm font-semibold text-primary-900 dark:text-primary-100 mb-3">Profile</h3>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
              <div className="w-12 h-12 rounded-full bg-primary-200 dark:bg-primary-800 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold text-lg">
                {(user?.name || user?.email || '?')[0].toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-primary-900 dark:text-primary-100">{user?.name || 'Teacher'}</p>
                <p className="text-sm text-primary-500 dark:text-primary-400">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Billing Section */}
          <div>
            <h3 className="text-sm font-semibold text-primary-900 dark:text-primary-100 mb-3">Subscription</h3>
            <div className="p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-primary-700 dark:text-primary-300">Status</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badge.color}`}>{badge.label}</span>
              </div>
              {isTrialing && (
                <p className="text-xs text-primary-500 dark:text-primary-400">
                  $20/month after trial. Cancel anytime before it ends to avoid charges.
                </p>
              )}
              {(isTrialing || isActive || isCanceled) ? (
                <button onClick={openPortal}
                  className="w-full py-2.5 px-4 rounded-lg font-medium text-sm bg-primary-500 text-white hover:bg-primary-600 transition-colors">
                  {isCanceled ? 'Reactivate Subscription' : 'Manage Subscription'}
                </button>
              ) : (isPastDue) ? (
                <button onClick={subscribe}
                  className="w-full py-2.5 px-4 rounded-lg font-medium text-sm bg-red-500 text-white hover:bg-red-600 transition-colors">
                  Update Payment Method
                </button>
              ) : (
                <button onClick={subscribe}
                  className="w-full py-2.5 px-4 rounded-lg font-medium text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-colors">
                  Start Free Trial
                </button>
              )}
              <p className="text-xs text-primary-400 dark:text-primary-500">
                Cancel anytime. Manage payment methods, billing history, and plan changes via Stripe.
              </p>
            </div>
          </div>

          {/* Change Password */}
          <div>
            <h3 className="text-sm font-semibold text-primary-900 dark:text-primary-100 mb-3">Change Password</h3>
            <ChangePasswordForm onClose={onClose} />
          </div>

          {/* Unlink Google */}
          <div>
            <h3 className="text-sm font-semibold text-primary-900 dark:text-primary-100 mb-3">Google Account</h3>
            <p className="text-xs text-primary-500 dark:text-primary-400 mb-2">
              If you linked your Google account, you can unlink it here. You must have a password set first.
            </p>
            <UnlinkGoogleButton />
          </div>

          {/* Danger Zone */}
          <div>
            <h3 className="text-sm font-semibold text-warm-700 dark:text-warm-400 mb-3">Danger Zone</h3>
            <DeleteAccountForm onClose={onClose} />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-primary-100 dark:border-slate-700">
          <p className="text-xs text-primary-400 dark:text-primary-500 text-center">
            Account settings are saved to the server
          </p>
        </div>
      </div>
    </div>
  );
}