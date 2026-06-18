// SuperLoopz wordmark. `light` renders for dark backgrounds.
export function Logo({ light = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground"
        aria-hidden
      >
        S
      </span>
      <span className={light ? 'text-white' : 'text-foreground'}>SuperLoopz</span>
    </span>
  );
}
