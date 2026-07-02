'use client';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export const ONBOARDING_STEPS = [
  { key: 'profile', label: 'Profile', path: '/vendor/onboarding/profile' },
  { key: 'company', label: 'Company', path: '/vendor/onboarding/company' },
  { key: 'legal', label: 'Legal', path: '/vendor/onboarding/legal' },
  { key: 'address', label: 'Address', path: '/vendor/onboarding/address' },
];

// Interactive stepper. `completed` = { profile, company, legal, address: bool }.
// Completed steps are clickable so vendors can jump back to review/edit; steps they
// haven't reached yet stay disabled.
export function OnboardingProgress({ current, completed = {} }) {
  const idx = ONBOARDING_STEPS.findIndex((s) => s.key === current);
  const doneCount = ONBOARDING_STEPS.filter((s) => completed[s.key]).length;
  const pct = Math.max(((idx + 1) / ONBOARDING_STEPS.length) * 100, (doneCount / ONBOARDING_STEPS.length) * 100);

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
          const done = !!completed[step.key];
          const active = step.key === current;
          const navigable = done && !active; // clickable = a completed step you're not on
          const marker = (
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-all',
                done && 'border-primary bg-primary text-primary-foreground',
                active && !done && 'border-primary text-primary',
                !done && !active && 'border-muted-foreground/30 text-muted-foreground',
                navigable && 'group-hover:ring-2 group-hover:ring-primary/30',
              )}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
          );
          const label = (
            <span className={cn('text-xs', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>
              {step.label}
            </span>
          );
          return (
            <li key={step.key} className="flex flex-col items-center gap-1.5 text-center">
              {navigable ? (
                <Link href={step.path} className="group flex flex-col items-center gap-1.5" title={`Edit ${step.label}`}>
                  {marker}
                  {label}
                </Link>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  {marker}
                  {label}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
