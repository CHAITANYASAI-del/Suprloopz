'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AppHeader } from '@/components/AppHeader';
import { isAdminPortal } from '@/lib/portal';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/vendors', label: 'Vendors', icon: Users, exact: false },
];

// Guards the admin panel to admin + support roles, with a top subnav.
export default function AdminLayout({ children }) {
  const { ready, isAuthenticated, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready) return;
    // The admin panel is only served on the staff portal instance.
    if (!isAdminPortal) return router.replace('/login');
    if (!isAuthenticated) return router.replace('/login');
    if (user?.role !== 'admin' && user?.role !== 'support') router.replace('/login');
  }, [ready, isAuthenticated, user, router]);

  if (!isAdminPortal || !ready || !isAuthenticated || (user?.role !== 'admin' && user?.role !== 'support')) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader subtitle="Admin panel" />
      <nav className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl gap-1 px-4">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            );
          })}
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
