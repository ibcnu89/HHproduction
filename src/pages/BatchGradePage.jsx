import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBilling } from '../contexts/BillingContext';
import BatchUploadZone from '../components/BatchUploadZone';
import BatchConfigPanel from '../components/BatchConfigPanel';
import BatchProgressBar from '../components/BatchProgressBar';
import BatchReviewGrid from '../components/BatchReviewGrid';

export default function BatchGradePage() {
  const { user } = useAuth();
  const { isActive, isTrialing } = useBilling();
  const hasAccess = isActive || isTrialing;

  const [step, setStep] = React.useState('upload'); // upload -> processing -> review
  const [images, setImages] = React.useState([]);
  const [gradeLevel, setGradeLevel] = React.useState('5');
  const [subject, setSubject] = React.useState('Math');
  const [rubric, setRubric] = React.useState('');
  const [standardsText, setStandardsText] = React.useState('');
  const [useCustomRubric, setUseCustomRubric] = React.useState(false);
  const [customRubricImage, setCustomRubricImage] = React.useState(null);
  const [isExtractingRubric, setIsExtractingRubric] = React.useState(false);
  const [batchId, setBatchId] = React.useState(null);
  const [results, setResults] = React.useState([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState(null);

  const canProceed = images.length > 0 && gradeLevel && subject;

  const handleStartBatch = async () => {
    if (!canProceed) return;
    
    setIsProcessing(true);
    setError(null);
    setResults([]);

    try {
      const formData = new FormData();
      images.forEach(img => formData.append('images', img.file));
      formData.append('gradeLevel', gradeLevel);
      formData.append('subject', subject);
      if (rubric) formData.append('rubric', rubric);
      if (standardsText) formData.append('standardsText', standardsText);

      const res = await fetch('/api/batch-grade', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Batch grading failed');
      }

      setBatchId(data.batch_id);
      setStep('processing');
    } catch (err) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    if (!batchId) return;
    window.open(`/api/batch-grade/export/${batchId}`, '_blank');
  };

  const handleOverride = async (batchId, imageIndex, overrides) => {
    try {
      const res = await fetch('/api/batch-grade/override', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batchId, image_index: imageIndex, overrides })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Override failed');
      
      // Update local results
      setResults(prev => prev.map((r, i) => i === imageIndex ? data.result : r));
    } catch (err) {
      alert('Failed to apply override: ' + err.message);
    }
  };

  const handleRetry = () => {
    setStep('upload');
    setBatchId(null);
    setIsProcessing(false);
    setError(null);
  };

  const handleClearCustomRubric = () => {
    setCustomRubricImage(null);
    setRubric('');
    setUseCustomRubric(false);
  };

  const handleCustomRubricImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCustomRubricImage(URL.createObjectURL(file));
    setIsExtractingRubric(true);

    try {
      const formData = new FormData();
      formData.append('imageBase64', file);
      formData.append('mimeType', file.type);

      // Use existing extract-rubric endpoint
      const res = await fetch('/api/extract-rubric', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        // Convert rubric array to text format
        const rubricText = data.map(item => 
          `${item.question_number}: ${item.correct_answer} (${item.points_possible} pts)`
        ).join('\n');
        setRubric(rubricText);
      }
    } catch (err) {
      console.error('Rubric extraction error:', err);
    } finally {
      setIsExtractingRubric(false);
    }
  };

  // Poll for results when in processing step
  React.useEffect(() => {
    if (step !== 'processing' || !batchId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/batch-grade/status/${batchId}`, {
          credentials: 'include'
        });
        const data = await res.json();
        
        if (data.status === 'completed') {
          // Fetch full results
          const resultsRes = await fetch(`/api/batch-grade/results/${batchId}`, {
            credentials: 'include'
          });
          const resultsData = await resultsRes.json();
          setResults(resultsData.results || []);
          setStep('review');
          setIsProcessing(false);
          clearInterval(pollInterval);
        } else if (data.status === 'failed') {
          setError(data.error || 'Batch processing failed');
          setIsProcessing(false);
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [step, batchId]);

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <svg className="w-16 h-16 mx-auto text-primary-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-100 mb-2">
          Subscription Required
        </h2>
        <p className="text-primary-600 dark:text-primary-400 mb-6">
          Batch grading requires an active subscription or trial. Upgrade to unlock this feature.
        </p>
        <button
          onClick={() => window.location.href = '/settings'}
          className="px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors font-medium"
        >
          Manage Subscription
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary-900 dark:text-primary-100 mb-2">
          Batch Grading
        </h1>
        <p className="text-primary-600 dark:text-primary-400">
          Upload multiple homework papers, configure once, grade all at once.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[
            { id: 'upload', label: 'Upload', icon: '📤' },
            { id: 'processing', label: 'Processing', icon: '⚙️' },
            { id: 'review', label: 'Review', icon: '✅' }
          ].map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                  (step === s.id || (['upload', 'processing', 'review'].indexOf(step) > i)) 
                    ? 'bg-primary-500 text-white' 
                    : 'bg-primary-100 dark:bg-slate-700 text-primary-500 dark:text-primary-400'
                }`}>
                  {s.icon}
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  (step === s.id || (['upload', 'processing', 'review'].indexOf(step) > i)) 
                    ? 'text-primary-900 dark:text-primary-100' 
                    : 'text-primary-500 dark:text-primary-400'
                }`}>
                  {s.label}
                </span>
              </div>
              {i < 2 && (
                <div className={`flex-1 h-1 mx-2 ${
                  ['upload', 'processing', 'review'].indexOf(step) > i 
                    ? 'bg-primary-500' 
                    : 'bg-primary-100 dark:bg-slate-700'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Error</span>
          </div>
          <p className="text-red-600 dark:text-red-500 text-sm">{error}</p>
          {step === 'processing' && (
            <button onClick={handleRetry} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm">
              Retry Batch
            </button>
          )}
        </div>
      )}

      {/* Step 1: Upload & Config */}
      {step === 'upload' && (
        <div className="space-y-6">
          <BatchUploadZone
            images={images}
            onImagesChange={setImages}
            maxFiles={50}
            isLoading={isProcessing}
          />

          <BatchConfigPanel
            gradeLevel={gradeLevel}
            subject={subject}
            rubric={rubric}
            standardsText={standardsText}
            onGradeLevelChange={setGradeLevel}
            onSubjectChange={setSubject}
            onRubricChange={setRubric}
            onStandardsTextChange={setStandardsText}
            useCustomRubric={useCustomRubric}
            onUseCustomRubricChange={setUseCustomRubric}
            customRubricImage={customRubricImage}
            onCustomRubricImageChange={handleCustomRubricImageChange}
            isExtractingRubric={isExtractingRubric}
            onClearCustomRubric={handleClearCustomRubric}
            isLoading={isProcessing}
          />

          <div className="flex justify-end">
            <button
              onClick={handleStartBatch}
              disabled={!canProceed || isProcessing}
              className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all ${
                canProceed && !isProcessing
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 shadow-lg hover:shadow-xl'
                  : 'bg-primary-100 dark:bg-slate-700 text-primary-300 dark:text-primary-600 cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Starting Batch...
                </span>
              ) : (
                `Grade All ${images.length} Papers`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Processing */}
      {step === 'processing' && (
        <BatchProgressBar
          batchId={batchId}
          totalImages={images.length}
          completedImages={0}
          status="processing"
        />
      )}

      {/* Step 3: Review */}
      {step === 'review' && (
        <div className="space-y-6">
          <BatchProgressBar
            batchId={batchId}
            totalImages={images.length}
            completedImages={images.length}
            status="completed"
          />

          <BatchReviewGrid
            results={results}
            onOverride={handleOverride}
            onExport={handleExport}
          />

          <div className="flex justify-center gap-4 pt-4 border-t border-primary-100 dark:border-slate-700">
            <button
              onClick={() => {
                setStep('upload');
                setImages([]);
                setBatchId(null);
                setResults([]);
                setRubric('');
                setStandardsText('');
                setUseCustomRubric(false);
                setCustomRubricImage(null);
              }}
              className="px-6 py-3 bg-primary-100 dark:bg-slate-700 text-primary-700 dark:text-primary-300 rounded-xl hover:bg-primary-200 dark:hover:bg-slate-600 transition-colors font-medium"
            >
              Start New Batch
            </button>
            <button
              onClick={handleExport}
              className="px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Download CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}