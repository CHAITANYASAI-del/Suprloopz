'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { AppHeader } from '@/components/AppHeader';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import { routes } from '@/lib/routes';

export default function OnboardingLayout({ children }) {
  const { ready, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const current = pathname.split('/')[3]; // /vendor/onboarding/<step>
  const [completed, setCompleted] = useState({});

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) router.replace(routes.vendorLogin);
  }, [ready, isAuthenticated, router]);

  // Load completion so the stepper can mark done steps and make them clickable.
  useEffect(() => {
    if (!isAuthenticated) return;
    db.onboarding()
      .then(({ onboarding: o }) =>
        setCompleted({
          profile: !!o?.profile_completed,
          company: !!o?.company_info_completed,
          legal: !!o?.legal_docs_completed,
          address: !!o?.address_completed,
        }),
      )
      .catch(() => {});
  }, [isAuthenticated, pathname]);

  if (!ready || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader subtitle="Vendor onboarding" />
      <OnboardingProgress current={current} completed={completed} />
      <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
    </div>
  );
}
