'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AppHeader } from '@/components/AppHeader';
import { AdminDataProvider } from '@/lib/adminData';
import { NotificationBell, Toaster } from '@/components/admin/Notifications';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const NAV = [
  { href: routes.adminHome, label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: routes.adminVendors, label: 'Vendors', icon: Users, exact: false },
];

// Guards the admin panel to admin + support roles, with a top subnav.
// The login + OIDC-callback routes live under /vendoradmin too, so they bypass
// the guard (otherwise an unauthenticated user would redirect-loop).
export default function AdminLayout({ children }) {
  const { ready, isAuthenticated, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic =
    pathname === routes.adminLogin ||
    pathname === routes.adminSetPassword ||
    pathname.startsWith(routes.adminCallback);

  useEffect(() => {
    if (isPublic || !ready) return;
    if (!isAuthenticated) return router.replace(routes.adminLogin);
    if (user?.role !== 'admin' && user?.role !== 'support') router.replace(routes.adminLogin);
  }, [isPublic, ready, isAuthenticated, user, router]);

  if (isPublic) return <>{children}</>;

  if (!ready || !isAuthenticated || (user?.role !== 'admin' && user?.role !== 'support')) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <AdminDataProvider>
      <div className="min-h-screen bg-muted/30">
        <AppHeader subtitle="Admin panel" />
        <nav className="border-b bg-background">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
            <div className="flex gap-1">
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
            <NotificationBell />
          </div>
        </nav>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <Toaster />
      </div>
    </AdminDataProvider>
  );
}
