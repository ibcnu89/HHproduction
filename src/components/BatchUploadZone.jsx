import React from 'react';

export default function BatchUploadZone({
  images,
  onImagesChange,
  maxFiles = 50,
  isLoading
}) {
  const fileInputRef = React.useRef(null);
  const dragActive = React.useRef(false);

  const handleDrag = (e, isEnter) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEnter) {
      dragActive.current = true;
    } else if (e.type === 'dragleave') {
      dragActive.current = false;
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragActive.current = false;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const addFiles = (newFiles) => {
    const validFiles = newFiles
      .filter(f => f.type.startsWith('image/'))
      .slice(0, maxFiles - images.length);
    
    if (validFiles.length === 0) return;

    const updatedImages = [...images];
    validFiles.forEach(file => {
      if (updatedImages.length < maxFiles) {
        const preview = URL.createObjectURL(file);
        updatedImages.push({ file, preview, id: `${Date.now()}-${Math.random()}` });
      }
    });
    onImagesChange(updatedImages);
  };

  const handleFileSelect = (e) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const removeImage = (id) => {
    const updated = images.filter(img => img.id !== id);
    onImagesChange(updated);
  };

  const isAtMax = images.length >= maxFiles;

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
        Homework Images ({images.length}/{maxFiles})
      </label>
      
      <div
        ref={fileInputRef}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
          dragActive.current
            ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
            : isAtMax
            ? 'border-sage-300 bg-sage-50 dark:bg-sage-900/20'
            : 'border-primary-200 hover:border-primary-300 dark:border-slate-600 dark:hover:border-slate-500'
        }`}
        onDragEnter={(e) => handleDrag(e, true)}
        onDragLeave={(e) => handleDrag(e, false)}
        onDragOver={(e) => handleDrag(e, true)}
        onDrop={handleDrop}
        onClick={() => !isAtMax && !isLoading && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileSelect}
          className="absolute inset-0 opacity-0 cursor-pointer"
          disabled={isLoading || isAtMax}
          aria-label="Upload homework images"
        />

        {images.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-64 overflow-y-auto pb-4">
              {images.map((img, idx) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.preview}
                    alt={`Homework ${idx + 1}`}
                    className="w-full h-24 object-cover rounded-lg border border-primary-100 dark:border-slate-600"
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs shadow-lg hover:bg-red-600"
                    aria-label={`Remove image ${idx + 1}`}
                  >
                    ×
                  </button>
                  <div className="absolute bottom-1 left-1 right-1 bg-black/70 text-white text-xs text-center px-1 rounded">
                    {idx + 1}
                  </div>
                </div>
              ))}
            </div>
            
            {!isAtMax && !isLoading && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-3 border-2 border-dashed border-primary-300 dark:border-slate-600 rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>Add more images</span>
              </button>
            )}
            
            {isAtMax && (
              <p className="text-xs text-primary-500 dark:text-primary-400 text-center">
                Maximum {maxFiles} images reached
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <svg className="w-12 h-12 mx-auto text-primary-300 dark:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <div>
              <p className="text-primary-600 dark:text-primary-400 font-medium">Drag & drop images here</p>
              <p className="text-primary-400 dark:text-primary-500 text-sm">or click to browse</p>
            </div>
            <p className="text-xs text-primary-300 dark:text-primary-600">JPG, PNG, WebP · Max 10MB each · Max 50 images</p>
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((img, idx) => (
            <span key={img.id} className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 dark:bg-primary-900/20 rounded-full text-xs text-primary-700 dark:text-primary-300">
              {idx + 1}. {img.file.name}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                className="ml-1 hover:text-primary-500"
                aria-label={`Remove ${img.file.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}