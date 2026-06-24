'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';
import { useAdminData } from '@/lib/adminData';
import { useAuth } from '@/lib/auth';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

export default function VendorsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { vendors = [], loading, error, refresh } = useAdminData() || {};

  const [tab, setTab] = useState('active');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  // Deep-link from the dashboard's "Invited" tile.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'invited') setTab('invited');
  }, []);

  const accepted = useMemo(() => vendors.filter((v) => v.accepted), [vendors]);
  const invited = useMemo(
    () => vendors.filter((v) => !v.accepted).sort((a, b) => new Date(b.invited_at || 0) - new Date(a.invited_at || 0)),
    [vendors],
  );

  const filtered = useMemo(() => {
    let rows = accepted;
    if (status !== 'all') rows = rows.filter((v) => (v.status || 'pending') === status);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((v) =>
        [v.email, v.first_name, v.last_name, v.legal_name].some((f) => (f || '').toLowerCase().includes(q)),
      );
    }
    return rows;
  }, [accepted, search, status]);

  const Tab = ({ id, label, count }) => (
    <button
      onClick={() => setTab(id)}
      className={cn(
        'flex items-center gap-2 border-b-2 px-1 pb-2 text-sm font-medium transition-colors',
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
          <p className="text-sm text-muted-foreground">
            {accepted.length} active · {invited.length} awaiting acceptance
          </p>
        </div>
        {isAdmin && <InviteVendorDialog onInvited={refresh} />}
      </div>

      <div className="flex gap-5 border-b">
        <Tab id="active" label="Active vendors" count={accepted.length} />
        <Tab id="invited" label="Invited" count={invited.length} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {tab === 'active' ? (
        <ActiveTab
          rows={filtered}
          loading={loading}
          search={search}
          setSearch={setSearch}
          status={status}
          setStatus={setStatus}
          onOpen={(id) => router.push(`/admin/vendors/${id}`)}
        />
      ) : (
        <InvitedTab rows={invited} loading={loading} isAdmin={isAdmin} />
      )}
    </div>
  );
}

function ActiveTab({ rows, loading, search, setSearch, status, setStatus, onOpen }) {
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or company…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead className="hidden md:table-cell">Company</TableHead>
                <TableHead className="hidden lg:table-cell">Industry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Onboarding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    No accepted vendors yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((v) => (
                  <TableRow key={v.id} className="cursor-pointer" onClick={() => onOpen(v.id)}>
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
                    <TableCell className="hidden lg:table-cell">{v.industry || '—'}</TableCell>
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
    </>
  );
}

function InvitedTab({ rows, loading, isAdmin }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead className="hidden sm:table-cell">Invited</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="py-12 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-12 text-center text-muted-foreground">
                  No pending invitations — everyone you invited has accepted. 🎉
                </TableCell>
              </TableRow>
            ) : (
              rows.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.email}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{timeAgo(v.invited_at)}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <InvitedActions vendor={v} />
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
