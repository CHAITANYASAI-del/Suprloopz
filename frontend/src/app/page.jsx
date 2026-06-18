'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { isAdminPortal } from '@/lib/portal';

// Landing route: send users to the right place based on portal + auth + role.
export default function Home() {
  const { ready, isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) return router.replace('/login');
    const isStaff = user?.role === 'admin' || user?.role === 'support';
    if (isAdminPortal) return router.replace(isStaff ? '/admin' : '/login');
    return router.replace(isStaff ? '/login' : '/dashboard');
  }, [ready, isAuthenticated, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      Loading SuperLoopz…
    </div>
  );
}
