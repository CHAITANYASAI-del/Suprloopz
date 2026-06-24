'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, ExternalLink, CheckCircle2, XCircle, Eye, Maximize2 } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const statusVariant = { active: 'success', pending: 'warning', suspended: 'destructive' };

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || '—'}</span>
    </div>
  );
}

export default function VendorDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [rejecting, setRejecting] = useState(null); // docId being rejected
  const [rejectReason, setRejectReason] = useState('');
  const [viewing, setViewing] = useState(null); // doc being previewed in the modal
  const iframeRef = useRef(null);

  const load = () => {
    setLoading(true);
    adminApi
      .getVendor(id)
      .then(setData)
      .catch((err) => setError(err.message || 'Could not load vendor'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeStatus = async (status) => {
    setBusy('status');
    try {
      await adminApi.setVendorStatus(id, status);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const fullscreen = () => iframeRef.current?.requestFullscreen?.();

  const verify = async (docId) => {
    setBusy(docId);
    try {
      await adminApi.verifyDoc(docId);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const reject = async (docId) => {
    if (!rejectReason.trim()) return;
    setBusy(docId);
    try {
      await adminApi.rejectDoc(docId);
      setRejecting(null);
      setRejectReason('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if ((error && !data) || (data && !data.user)) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/vendors')} className="-ml-2">
          <ArrowLeft className="h-4 w-4" /> Back to vendors
        </Button>
        <Alert variant="destructive">
          <AlertDescription>{error || 'This vendor could not be found.'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { user: u, profile, company, onboarding, documents = [], addresses = [], activity = [] } = data;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/admin/vendors')} className="-ml-2">
        <ArrowLeft className="h-4 w-4" /> Back to vendors
      </Button>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {profile?.first_name || profile?.last_name
              ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
              : u.email}
          </h1>
          <p className="text-sm text-muted-foreground">{u.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={statusVariant[profile?.status] || 'secondary'}>{profile?.status || 'pending'}</Badge>
          {isAdmin && (
            <div className="w-40">
              <Select value={profile?.status || 'pending'} onValueChange={changeStatus} disabled={busy === 'status'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="First name" value={profile?.first_name} />
            <Row label="Last name" value={profile?.last_name} />
            <Row label="Phone" value={profile?.phone} />
            <Row label="Onboarding step" value={profile?.onboarding_step} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Legal name" value={company?.legal_name} />
            <Row label="Trade name" value={company?.trade_name} />
            <Row label="Registration #" value={company?.registration_number} />
            <Row label="Industry" value={company?.industry} />
            <Row label="Vendor type" value={company?.vendor_type} />
            <Row label="Category" value={company?.vendor_category} />
            <Row label="Employees" value={company?.number_of_employees} />
            <Row label="Turnover" value={company?.annual_turnover} />
            <Row label="Website" value={company?.website} />
            <Row label="Company email" value={company?.company_email} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Legal documents</CardTitle>
          <CardDescription>Stored in Supabase Storage. Access via signed links only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {documents.length === 0 && <p className="text-sm text-muted-foreground">No documents submitted.</p>}
          {documents.map((d) => (
            <div key={d.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {d.doc_type} · {d.doc_name}
                  </p>
                  <p className="text-xs text-muted-foreground">{d.doc_number}</p>
                </div>
                <div className="flex items-center gap-2">
                  {d.verified ? <Badge variant="success">Verified</Badge> : <Badge variant="warning">Pending</Badge>}
                  <Button variant="outline" size="sm" disabled={!d.signed_url} onClick={() => setViewing(d)}>
                    <Eye className="h-4 w-4" /> View
                  </Button>
                  {isAdmin && !d.verified && (
                    <>
                      <Button size="sm" disabled={busy === d.id} onClick={() => verify(d.id)}>
                        <CheckCircle2 className="h-4 w-4" /> Verify
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={busy === d.id}
                        onClick={() => setRejecting(rejecting === d.id ? null : d.id)}
                      >
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {isAdmin && rejecting === d.id && (
                <div className="mt-3 flex gap-2">
                  <Input
                    placeholder="Reason for rejection"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <Button size="sm" variant="destructive" disabled={busy === d.id || !rejectReason.trim()} onClick={() => reject(d.id)}>
                    Confirm
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Addresses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {addresses.length === 0 && <p className="text-sm text-muted-foreground">No addresses.</p>}
            {addresses.map((a) => (
              <div key={a.id} className="text-sm">
                <p className="font-medium capitalize">{a.type}</p>
                <p className="text-muted-foreground">
                  {[a.street_address, a.city, a.state, a.postal_code, a.country].filter(Boolean).join(', ')}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity</CardTitle>
            <CardDescription>Recent audit-log events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {activity.length === 0 && <p className="text-sm text-muted-foreground">No activity.</p>}
            {activity.map((ev, i) => (
              <div key={i} className="flex justify-between gap-2 text-xs">
                <span className="font-mono">{ev.action}</span>
                <span className="text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Onboarding status</CardTitle>
        </CardHeader>
        <CardContent>
          <Row label="Password reset" value={onboarding?.password_reset ? 'Yes' : 'No'} />
          <Row label="Profile completed" value={onboarding?.profile_completed ? 'Yes' : 'No'} />
          <Row label="Company info" value={onboarding?.company_info_completed ? 'Yes' : 'No'} />
          <Row label="Legal docs" value={onboarding?.legal_docs_completed ? 'Yes' : 'No'} />
          <Row label="Address" value={onboarding?.address_completed ? 'Yes' : 'No'} />
          <Row label="Fully onboarded" value={onboarding?.fully_onboarded ? 'Yes' : 'No'} />
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center justify-between gap-3 pr-6">
              <span>
                {viewing?.doc_type} · {viewing?.doc_name}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={fullscreen}>
                  <Maximize2 className="h-4 w-4" /> Fullscreen
                </Button>
                <a href={viewing?.signed_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4" /> New tab
                  </Button>
                </a>
              </div>
            </DialogTitle>
          </DialogHeader>
          {viewing?.signed_url && (
            <iframe
              ref={iframeRef}
              src={viewing.signed_url}
              title={`${viewing.doc_type} document`}
              className="h-[75vh] w-full rounded-md border bg-white"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
