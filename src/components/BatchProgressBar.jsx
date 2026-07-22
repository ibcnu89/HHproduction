import React from 'react';

export default function BatchProgressBar({
  batchId,
  totalImages,
  completedImages = 0,
  status,
  error,
  onRetry,
  pollingInterval = 2000
}) {
  const [progress, setProgress] = React.useState({
    total: totalImages,
    completed: completedImages,
    status,
    error
  });

  React.useEffect(() => {
    setProgress(p => ({ ...p, total: totalImages, completed: completedImages, status, error }));
  }, [totalImages, completedImages, status, error]);

  React.useEffect(() => {
    if (!batchId || status === 'completed' || status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/batch-grade/status/${batchId}`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setProgress(prev => ({
            ...prev,
            completed: data.completed_images,
            status: data.status,
            error: data.error,
            progress_pct: data.progress_pct
          }));
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Batch status poll error:', err);
      }
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [batchId, status, pollingInterval]);

  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const isProcessing = progress.status === 'processing';
  const isComplete = progress.status === 'completed';
  const hasError = progress.status === 'failed';

  if (!isProcessing && !isComplete && !hasError && progress.completed === 0) {
    return null; // Not started yet
  }

  return (
    <div className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-primary-100 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-primary-900 dark:text-primary-100">
          Batch Grading Progress
        </h3>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          isProcessing ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
          isComplete ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
          hasError ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
          'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
        }`}>
          {isProcessing ? 'Processing' : isComplete ? 'Complete' : hasError ? 'Failed' : 'Pending'}
        </span>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-primary-600 dark:text-primary-400">
            {progress.completed} / {progress.total} images
          </span>
          <span className="text-primary-600 dark:text-primary-400 font-medium">
            {pct}%
          </span>
        </div>
        <div className="h-3 bg-primary-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isProcessing ? 'bg-gradient-to-r from-primary-500 to-primary-600' :
              isComplete ? 'bg-green-500' :
              hasError ? 'bg-red-500' : 'bg-primary-400'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Per-image status indicators */}
      {progress.total > 0 && (
        <div className="flex flex-wrap gap-1 mb-4" role="img" aria-label={`${progress.completed} completed, ${progress.total - progress.completed} remaining`}>
          {Array.from({ length: progress.total }, (_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < progress.completed ? 'bg-green-500' :
                i === progress.completed && isProcessing ? 'bg-primary-500 animate-pulse' :
                'bg-primary-200 dark:bg-slate-600'
              }`}
              title={`Image ${i + 1}: ${i < progress.completed ? 'Done' : i === progress.completed ? 'Processing' : 'Pending'}`}
            />
          ))}
        </div>
      )}

      {hasError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Batch grading failed</span>
          </div>
          <p className="text-sm text-red-600 dark:text-red-500 mb-3">
            {progress.error || 'An unknown error occurred during batch processing.'}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              Retry Batch
            </button>
          )}
        </div>
      )}

      {isComplete && (
        <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">All {progress.total} images graded successfully!</span>
          </div>
        </div>
      )}
    </div>
  );
}