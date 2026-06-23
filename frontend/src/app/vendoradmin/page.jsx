'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, CheckCircle2, Clock, Ban, ShieldCheck, FileClock, ArrowRight, Loader2, MailPlus } from 'lucide-react';
import { useAdminData } from '@/lib/adminData';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { InviteVendorDialog } from '@/components/admin/InviteVendorDialog';
import { StatusBadge, Avatar, OnboardingDots, vendorName } from '@/components/admin/shared';

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
  const { vendors, stats, loading, refresh } = useAdminData() || {};

  // Only accepted vendors belong on the dashboard; un-accepted invites live on the
  // Vendors → Invited tab. Show the most recently accepted first.
  const recent = (vendors || [])
    .filter((v) => v.accepted)
    .sort((a, b) => new Date(b.accepted_at || 0) - new Date(a.accepted_at || 0))
    .slice(0, 8);

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
        <Link href="/vendoradmin/vendors?tab=invited" className="contents">
          <StatCard icon={MailPlus} label="Invited" value={stats?.invited} tone="default" loading={loading} />
        </Link>
        <StatCard icon={CheckCircle2} label="Active" value={stats?.active} tone="success" loading={loading} />
        <StatCard icon={Clock} label="Pending" value={stats?.pending} tone="warning" loading={loading} />
        <StatCard icon={Ban} label="Suspended" value={stats?.suspended} tone="danger" loading={loading} />
        <StatCard icon={ShieldCheck} label="Fully onboarded" value={stats?.fully_onboarded} tone="success" loading={loading} />
        <StatCard icon={FileClock} label="Docs to review" value={stats?.pending_doc_reviews} tone="warning" loading={loading} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent vendors</CardTitle>
          <Link href="/vendoradmin/vendors">
            <Button variant="ghost" size="sm">
              View all <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
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
              ) : recent.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    No vendors yet. Invite your first vendor to get started.
                  </TableCell>
                </TableRow>
              ) : (
                recent.map((v) => (
                  <TableRow key={v.id} className="cursor-pointer" onClick={() => router.push(`/vendoradmin/vendors/${v.id}`)}>
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
        </CardContent>
      </Card>
    </div>
  );
}
