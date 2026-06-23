'use client';
import { useEffect, useRef, useState } from 'react';
import { Bell, UserPlus, CheckCircle2, BadgeCheck, X } from 'lucide-react';
import { useAdminData } from '@/lib/adminData';
import { cn } from '@/lib/utils';

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

const META = {
  invited: { icon: UserPlus, color: 'text-blue-600', verb: 'was invited' },
  accepted: { icon: CheckCircle2, color: 'text-green-600', verb: 'accepted the invitation' },
  onboarded: { icon: BadgeCheck, color: 'text-violet-600', verb: 'completed onboarding' },
};

// Bell with unread badge + dropdown activity feed.
export function NotificationBell() {
  const ctx = useAdminData();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!ctx) return null;
  const { events, unreadCount, lastSeen, markAllSeen } = ctx;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) markAllSeen();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border bg-background text-foreground shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            {events.length > 0 && (
              <button onClick={markAllSeen} className="text-xs text-muted-foreground hover:text-foreground">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {events.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              events.slice(0, 30).map((e) => {
                const m = META[e.type];
                const Icon = m.icon;
                const unread = new Date(e.at).getTime() > lastSeen;
                return (
                  <div key={e.id} className={cn('flex gap-3 px-4 py-3 text-sm', unread && 'bg-muted/50')}>
                    <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', m.color)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        <span className="font-medium">{e.name}</span> {m.verb}
                      </p>
                      <p className="text-xs text-muted-foreground">{timeAgo(e.at)}</p>
                    </div>
                    {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Fixed stack of auto-dismissing toasts.
export function Toaster() {
  const ctx = useAdminData();
  if (!ctx) return null;
  const { toasts, dismissToast } = ctx;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 rounded-lg border bg-background p-3 shadow-lg animate-in slide-in-from-right-4"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t.title}</p>
            <p className="text-sm text-muted-foreground">{t.message}</p>
          </div>
          <button onClick={() => dismissToast(t.id)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
