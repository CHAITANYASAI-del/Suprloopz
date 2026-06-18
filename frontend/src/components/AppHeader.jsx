'use client';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';

// Dark application header used on authenticated pages.
export function AppHeader({ subtitle }) {
  const { user, logout, isAuthenticated } = useAuth();
  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Logo light />
          {subtitle && <span className="text-sm text-white/60">/ {subtitle}</span>}
        </div>
        {isAuthenticated && (
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-white/70 sm:inline">
              {user?.email} · <span className="uppercase tracking-wide">{user?.role}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={logout} className="text-white hover:bg-white/10">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
