'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InviteVendorDialog } from '@/components/admin/InviteVendorDialog';
import { StatusBadge, Avatar, OnboardingDots, vendorName } from '@/components/admin/shared';

export default function VendorsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [vendors, setVendors] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      setListError('');
      try {
        const res = await api.listVendors({
          page,
          search: search || undefined,
          status: status === 'all' ? undefined : status,
        });
        setVendors(res.vendors);
        setPagination(res.pagination);
      } catch (err) {
        setListError(err.message || 'Could not load vendors');
      } finally {
        setLoading(false);
      }
    },
    [search, status],
  );

  useEffect(() => {
    load(1);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSearch = (e) => {
    e.preventDefault();
    load(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
          <p className="text-sm text-muted-foreground">{pagination.total} total</p>
        </div>
        {isAdmin && <InviteVendorDialog onInvited={() => load(1)} />}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={onSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or company…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
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

      {listError && (
        <Alert variant="destructive">
          <AlertDescription>{listError}</AlertDescription>
        </Alert>
      )}

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
              ) : vendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    No vendors found.
                  </TableCell>
                </TableRow>
              ) : (
                vendors.map((v) => (
                  <TableRow
                    key={v.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/vendors/${v.id}`)}
                  >
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

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => load(pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
