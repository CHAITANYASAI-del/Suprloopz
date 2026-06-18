import { Label } from '@/components/ui/label';

// Label + control + inline error wrapper used across all forms.
export function Field({ label, htmlFor, error, required, hint, children, className = '' }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
