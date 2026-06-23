'use client';
// Resend / Revoke actions for a single pending invite. Shared by the Vendors →
// Invited tab and the dashboard's Invited vendors tab so behaviour stays identical.
import { useState } from 'react';
import { Loader2, Send, Ban, Check } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { useAdminData } from '@/lib/adminData';
import { Button } from '@/components/ui/button';

export function InvitedActions({ vendor }) {
  const { refresh } = useAdminData() || {};
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState('');

  const resend = async () => {
    setBusy(true);
    setErr('');
    try {
      await adminApi.resendInvite(vendor.id);
      setResent(true);
      setTimeout(() => setResent(false), 2500);
    } catch (e) {
      setErr(e.message || 'Could not resend');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    setErr('');
    try {
      await adminApi.deleteVendor(vendor.id);
      await refresh?.();
    } catch (e) {
      setErr(e.message || 'Could not revoke');
      setBusy(false);
    }
  };

  if (confirm) {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">Revoke? Their link stops working.</span>
        <Button size="sm" variant="destructive" disabled={busy} onClick={revoke}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Revoke'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setConfirm(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {err && <span className="text-xs text-destructive">{err}</span>}
      <Button size="sm" variant="outline" disabled={busy} onClick={resend}>
        {resent ? (
          <>
            <Check className="h-4 w-4" /> Sent
          </>
        ) : (
          <>
            <Send className="h-4 w-4" /> Resend
          </>
        )}
      </Button>
      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}>
        <Ban className="h-4 w-4" /> Revoke
      </Button>
    </div>
  );
}
