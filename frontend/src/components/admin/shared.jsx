// Small shared building blocks for the admin panel.
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS = {
  active: { variant: 'success', label: 'Active' },
  pending: { variant: 'warning', label: 'Pending' },
  suspended: { variant: 'destructive', label: 'Suspended' },
};

export function StatusBadge({ status }) {
  const s = STATUS[status] || { variant: 'secondary', label: status || 'pending' };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

// Deterministic colour-from-string for avatar backgrounds.
const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
];

export function Avatar({ name, email, size = 'md' }) {
  const text = (name || email || '?').trim();
  const initials = text
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const colorIdx = [...text].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  const dims = size === 'lg' ? 'h-12 w-12 text-base' : 'h-9 w-9 text-xs';
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', dims, AVATAR_COLORS[colorIdx])}>
      {initials || '?'}
    </span>
  );
}

// Compact 5-dot onboarding progress indicator.
export function OnboardingDots({ onboarding }) {
  const steps = [
    onboarding?.password_reset,
    onboarding?.profile_completed,
    onboarding?.company_info_completed,
    onboarding?.legal_docs_completed,
    onboarding?.address_completed,
  ];
  // The list endpoint only exposes fully_onboarded + legal flag; tolerate both shapes.
  const fallback = onboarding?.fully_onboarded ? [true, true, true, true, true] : null;
  const dots = steps.some((s) => s != null) ? steps : fallback || [false, false, false, false, false];
  const done = dots.filter(Boolean).length;
  return (
    <div className="flex items-center gap-1.5" title={`${done}/5 steps`}>
      {dots.map((d, i) => (
        <span key={i} className={cn('h-1.5 w-5 rounded-full', d ? 'bg-primary' : 'bg-muted-foreground/20')} />
      ))}
    </div>
  );
}

export function vendorName(v) {
  const n = `${v.first_name || ''} ${v.last_name || ''}`.trim();
  return n || null;
}
