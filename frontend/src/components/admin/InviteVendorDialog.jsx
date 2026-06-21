'use client';
import { useState } from 'react';
import { Loader2, UserPlus, MailCheck } from 'lucide-react';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/Field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

// Reusable invite button + modal for either a vendor (default) or a staff/admin.
// Calls onInvited() after success so the caller can refresh its data.
export function InviteVendorDialog({ onInvited, triggerClassName, role = 'vendor' }) {
  const isStaff = role === 'admin';
  const noun = isStaff ? 'staff member' : 'vendor';
  const triggerLabel = isStaff ? 'Invite staff' : 'Invite vendor';
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
      await db.invite(email.trim(), role);
      setOk(
        isStaff
          ? `Invite sent to ${email.trim()}. They'll get an email to set their password, then they can sign in to the staff panel.`
          : `Invitation sent to ${email.trim()}. They'll get an email to set their password and start onboarding.`,
      );
      setEmail('');
      onInvited?.();
    } catch (err) {
      if (err.status === 409) setError('A user with this email already exists');
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
        <Button className={triggerClassName} variant={isStaff ? 'outline' : 'default'}>
          <UserPlus className="h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a {noun}</DialogTitle>
          <DialogDescription>
            We&apos;ll create their account and email a secure link to set their password.
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
              <Field label={`${isStaff ? 'Staff' : 'Vendor'} email`} htmlFor="invite-email" error={error} required>
                <Input
                  id="invite-email"
                  type="email"
                  autoFocus
                  placeholder={isStaff ? 'teammate@superloopz.com' : 'vendor@company.com'}
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
