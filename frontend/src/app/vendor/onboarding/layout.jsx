'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AppHeader } from '@/components/AppHeader';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import { routes } from '@/lib/routes';

export default function OnboardingLayout({ children }) {
  const { ready, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const current = pathname.split('/')[3]; // /vendor/onboarding/<step>

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) router.replace(routes.vendorLogin);
  }, [ready, isAuthenticated, router]);

  if (!ready || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader subtitle="Vendor onboarding" />
      <OnboardingProgress current={current} />
      <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
    </div>
  );
}
