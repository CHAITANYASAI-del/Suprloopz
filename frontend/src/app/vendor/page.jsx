'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { routes } from '@/lib/routes';

// Vendor portal landing: route to dashboard if signed in, else to login.
export default function VendorHome() {
  const { ready, isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) return router.replace(routes.vendorLogin);
    // Staff who land here are sent to their portal.
    if (user?.role === 'admin' || user?.role === 'support') return router.replace(routes.adminHome);
    router.replace(routes.vendorDashboard);
  }, [ready, isAuthenticated, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>
  );
}
