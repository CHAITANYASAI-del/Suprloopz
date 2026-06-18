'use client';
import { useState } from 'react';
import { Loader2, UserPlus, MailCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/Field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

// Reusable "Invite vendor" button + modal. Calls onInvited() after success so
// the caller can refresh its data.
export function InviteVendorDialog({ onInvited, triggerClassName }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setEmail('');
    setError('');
    setOk('');
    setLoading(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError('Enter a valid email address');
    setLoading(true);
    try {
      const key = (typeof crypto !== 'undefined' && crypto.randomUUID?.()) || `inv-${Date.now()}`;
      await api.inviteVendor(email.trim(), key);
      setOk(`Invitation sent to ${email.trim()}. They'll receive their temporary password by email.`);
      setEmail('');
      onInvited?.();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError('A user with this email already exists');
      else setError(err.message || 'Could not send the invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className={triggerClassName}>
          <UserPlus className="h-4 w-4" /> Invite vendor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a vendor</DialogTitle>
          <DialogDescription>
            We&apos;ll create their account and email a temporary password with a login link.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {ok ? (
            <Alert variant="success">
              <MailCheck className="h-4 w-4" />
              <AlertDescription>{ok}</AlertDescription>
            </Alert>
          ) : (
            <>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Field label="Vendor email" htmlFor="invite-email" error={error} required>
                <Input
                  id="invite-email"
                  type="email"
                  autoFocus
                  placeholder="vendor@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!error}
                />
              </Field>
            </>
          )}

          <div className="flex justify-end gap-2">
            {ok ? (
              <>
                <Button type="button" variant="outline" onClick={() => setOk('')}>
                  Invite another
                </Button>
                <Button type="button" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </>
            ) : (
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Sending…' : 'Send invite'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
