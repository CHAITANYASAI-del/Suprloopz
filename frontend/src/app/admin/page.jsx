'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, CheckCircle2, Clock, Ban, ShieldCheck, FileClock, ArrowRight, Loader2, MailPlus } from 'lucide-react';
import { useAdminData } from '@/lib/adminData';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { InviteVendorDialog } from '@/components/admin/InviteVendorDialog';
import { InvitedActions } from '@/components/admin/InvitedActions';
import { StatusBadge, Avatar, OnboardingDots, vendorName } from '@/components/admin/shared';
import { cn } from '@/lib/utils';

function timeAgo(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

function StatCard({ icon: Icon, label, value, tone = 'default', loading }) {
  const tones = {
    default: 'bg-secondary text-secondary-foreground',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-rose-100 text-rose-700',
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-2xl font-semibold leading-none">
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (value ?? 0)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { vendors, stats, loading, refresh } = useAdminData() || {};
  const [tab, setTab] = useState('active');

  const all = vendors || [];
  const recentActive = all
    .filter((v) => v.accepted)
    .sort((a, b) => new Date(b.accepted_at || 0) - new Date(a.accepted_at || 0))
    .slice(0, 6);
  const recentInvited = all
    .filter((v) => !v.accepted)
    .sort((a, b) => new Date(b.invited_at || 0) - new Date(a.invited_at || 0))
    .slice(0, 6);
  const activeCount = all.filter((v) => v.accepted).length;
  const invitedCount = all.length - activeCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your vendor base.</p>
        </div>
        {user?.role === 'admin' && <InviteVendorDialog onInvited={refresh} />}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Users} label="Total vendors" value={stats?.total} tone="primary" loading={loading} />
        <Link href="/admin/vendors?tab=invited" className="contents">
          <StatCard icon={MailPlus} label="Invited" value={stats?.invited} tone="default" loading={loading} />
        </Link>
        <StatCard icon={CheckCircle2} label="Active" value={stats?.active} tone="success" loading={loading} />
        <StatCard icon={Clock} label="Pending" value={stats?.pending} tone="warning" loading={loading} />
        <StatCard icon={Ban} label="Suspended" value={stats?.suspended} tone="danger" loading={loading} />
        <StatCard icon={ShieldCheck} label="Fully onboarded" value={stats?.fully_onboarded} tone="success" loading={loading} />
        <StatCard icon={FileClock} label="Docs to review" value={stats?.pending_doc_reviews} tone="warning" loading={loading} />
      </div>

      <Card>
        <CardHeader className="border-b pb-0">
          <div className="flex gap-5">
            <DashTab id="active" label="Active vendors" count={activeCount} tab={tab} setTab={setTab} />
            <DashTab id="invited" label="Invited vendors" count={invitedCount} tab={tab} setTab={setTab} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {tab === 'active' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="hidden md:table-cell">Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Onboarding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : recentActive.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      No active vendors yet. Invited vendors appear here once they accept.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentActive.map((v) => (
                    <TableRow key={v.id} className="cursor-pointer" onClick={() => router.push(`/admin/vendors/${v.id}`)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={vendorName(v)} email={v.email} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{vendorName(v) || '—'}</p>
                            <p className="truncate text-xs text-muted-foreground">{v.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{v.legal_name || '—'}</TableCell>
                      <TableCell>
                        <StatusBadge status={v.status} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <OnboardingDots onboarding={v} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden sm:table-cell">Invited</TableHead>
                  <TableHead>{isAdmin ? <span className="sr-only">Actions</span> : 'Status'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : recentInvited.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                      No pending invitations.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentInvited.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.email}</TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">{timeAgo(v.invited_at)}</TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <InvitedActions vendor={v} />
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Awaiting acceptance
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
          <div className="flex justify-center border-t p-3">
            <Link href={`/admin/vendors?tab=${tab}`}>
              <Button variant="ghost" size="sm">
                View all {tab === 'active' ? 'vendors' : 'invited'} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DashTab({ id, label, count, tab, setTab }) {
  return (
    <button
      onClick={() => setTab(id)}
      className={cn(
        'flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors',
        tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
      <span
        className={cn(
          'rounded-full px-1.5 py-0.5 text-xs',
          tab === id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  );
}
