/**
 * Classroom Connection Status Component
 */

import { useClassroomStatus, useClassroomConnect, useClassroomDisconnect } from '../hooks/useClassroom';

export default function ClassroomConnect({ onConnected }) {
  const { status, refetch } = useClassroomStatus();
  const { connect, loading: connectLoading, error: connectError } = useClassroomConnect();
  const { disconnect, loading: disconnectLoading, error: disconnectError } = useClassroomDisconnect();

  if (status.loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-primary-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-4">
          <svg className="animate-spin h-6 w-6 text-primary-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-primary-500 dark:text-primary-400">Checking Classroom connection...</span>
        </div>
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-primary-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Connect Google Classroom</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Import classes, assignments, and student work automatically</p>
          </div>
        </div>
        {(connectError || disconnectError) && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {connectError || disconnectError}
          </div>
        )}
        <button
          onClick={() => connect('/classroom')}
          disabled={connectLoading}
          className="mt-4 w-full sm:w-auto px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {connectLoading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Connecting...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,4.177-5.445,4.646v2.941c5.082-0.476,9-4.312,9-9.344C21,8.563,16.607,3.5,11.187,3.5S1.5,8.563,1.5,14.044c0,1.798,0.517,3.45,1.382,4.818l4.394-4.393c0.372-0.372,0.974-0.372,1.346,0l3.322,3.321C13.021,17.313,12.636,14.288,12.545,10.239z" />
              </svg>
              Connect Google Classroom
            </>
          )}
        </button>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          You'll be asked to grant permission to view your classes, assignments, and student submissions.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-primary-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Google Classroom Connected</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Ready to sync your classes and assignments</p>
            {status.expired && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">⚠ Token expired - will auto-refresh on next sync</p>
            )}
          </div>
        </div>
        <button
          onClick={disconnect}
          disabled={disconnectLoading}
          className="px-4 py-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium text-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
        >
          {disconnectLoading ? 'Disconnecting...' : 'Disconnect'}
        </button>
      </div>
    </div>
  );
}