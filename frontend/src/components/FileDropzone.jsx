'use client';
import { useRef, useState } from 'react';
import { UploadCloud, FileText, X, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg', 'application/pdf'];

// Drag-and-drop file input with client-side validation (type + 5MB limit).
// Calls onFile(file) with a valid File, or onFile(null) when cleared.
export function FileDropzone({ onFile, uploaded, uploading, error }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState('');
  const [fileName, setFileName] = useState('');

  const validate = (file) => {
    if (!ACCEPTED.includes(file.type)) return 'Only PNG, JPEG or PDF files are allowed';
    if (file.size > MAX_BYTES) return 'File exceeds the 5MB limit';
    return '';
  };

  const handleFiles = (files) => {
    const file = files?.[0];
    if (!file) return;
    const err = validate(file);
    if (err) {
      setLocalError(err);
      setFileName('');
      onFile(null);
      return;
    }
    setLocalError('');
    setFileName(file.name);
    onFile(file);
  };

  const clear = (e) => {
    e.stopPropagation();
    setFileName('');
    setLocalError('');
    onFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const shownError = localError || error;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50',
          shownError && 'border-destructive',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : uploaded ? (
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        ) : fileName ? (
          <FileText className="h-6 w-6 text-primary" />
        ) : (
          <UploadCloud className="h-6 w-6 text-muted-foreground" />
        )}

        {fileName ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="max-w-[220px] truncate font-medium">{fileName}</span>
            <button type="button" onClick={clear} className="text-muted-foreground hover:text-destructive">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-primary">Click to upload</span> or drag and drop
            <br />
            <span className="text-xs">PNG, JPEG or PDF · up to 5MB</span>
          </p>
        )}
      </div>
      {shownError && <p className="mt-1 text-xs font-medium text-destructive">{shownError}</p>}
    </div>
  );
}
