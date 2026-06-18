'use client';
import { Check } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export const ONBOARDING_STEPS = [
  { key: 'profile', label: 'Profile', path: '/onboarding/profile' },
  { key: 'company', label: 'Company', path: '/onboarding/company' },
  { key: 'legal', label: 'Legal', path: '/onboarding/legal' },
  { key: 'address', label: 'Address', path: '/onboarding/address' },
];

// Progress bar + step markers shown across all onboarding pages.
export function OnboardingProgress({ current }) {
  const idx = ONBOARDING_STEPS.findIndex((s) => s.key === current);
  const pct = ((idx + 1) / ONBOARDING_STEPS.length) * 100;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-8">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">
          Step {idx + 1} of {ONBOARDING_STEPS.length}
        </span>
        <span className="text-muted-foreground">{ONBOARDING_STEPS[idx]?.label}</span>
      </div>
      <Progress value={pct} />
      <ol className="mt-4 grid grid-cols-4 gap-2">
        {ONBOARDING_STEPS.map((step, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <li key={step.key} className="flex flex-col items-center gap-1.5 text-center">
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold',
                  done && 'border-primary bg-primary text-primary-foreground',
                  active && 'border-primary text-primary',
                  !done && !active && 'border-muted-foreground/30 text-muted-foreground',
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cn('text-xs', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
