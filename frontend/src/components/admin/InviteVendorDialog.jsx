'use client';
import { useState } from 'react';
import { Loader2, UserPlus, MailCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/Field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Splits a free-text blob into a deduped list of emails. Accepts commas,
// semicolons, spaces and newlines as separators, so one or many can be pasted.
function parseEmails(text) {
  const list = (text || '')
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(list)];
}

// Invite one or many vendors. Calls onInvited() after at least one succeeds so the
// caller can refresh its data.
export function InviteVendorDialog({ onInvited, triggerClassName }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState(null); // array of { email, ok, emailed, error, link }
  const [loading, setLoading] = useState(false);

  const emails = parseEmails(text);
  const invalid = emails.filter((e) => !EMAIL_RE.test(e));

  const reset = () => {
    setText('');
    setError('');
    setResults(null);
    setLoading(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setResults(null);
    if (!emails.length) return setError('Enter at least one email address');
    if (invalid.length) return setError(`These don't look like valid emails: ${invalid.join(', ')}`);

    setLoading(true);
    try {
      const res = await adminApi.inviteMany(emails);
      setResults(res);
      if (res.some((r) => r.ok)) onInvited?.();
    } catch (err) {
      setError(err.message || 'Could not send the invites');
    } finally {
      setLoading(false);
    }
  };

  const sent = results?.filter((r) => r.ok) || [];
  const emailedCount = sent.filter((r) => r.emailed).length;
  const notEmailed = sent.filter((r) => !r.emailed);

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
          <DialogTitle>Invite vendors</DialogTitle>
          <DialogDescription>
            Add one email, or paste many (separated by commas, spaces or new lines). Each
            gets an account and an email with a temporary password to get started.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="space-y-4">
            {emailedCount > 0 && (
              <Alert variant="success">
                <MailCheck className="h-4 w-4" />
                <AlertDescription>
                  Emailed {emailedCount} vendor{emailedCount > 1 ? 's' : ''} a temporary password
                  to set their own and start onboarding.
                </AlertDescription>
              </Alert>
            )}
            {notEmailed.length > 0 && (
              <Alert variant="warning">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {notEmailed.length} account{notEmailed.length > 1 ? 's were' : ' was'} created but
                  the invite email couldn&apos;t be sent. Double-check the address, then try inviting
                  again.
                </AlertDescription>
              </Alert>
            )}
            <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
              {results.map((r) => (
                <li key={r.email} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <span className="truncate">{r.email}</span>
                  {r.ok ? (
                    <span className={`flex shrink-0 items-center gap-1 ${r.emailed ? 'text-green-700' : 'text-amber-600'}`}>
                      <CheckCircle2 className="h-4 w-4" /> {r.emailed ? 'Invited' : 'Created'}
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 text-destructive">
                      <AlertCircle className="h-4 w-4" /> {r.error}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={reset}>
                Invite more
              </Button>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Field label="Vendor email(s)" htmlFor="invite-emails" required>
              <Textarea
                id="invite-emails"
                autoFocus
                rows={4}
                placeholder={'vendor@company.com\nanother@company.com, third@company.com'}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </Field>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {emails.length > 0 ? `${emails.length} email${emails.length > 1 ? 's' : ''} ready` : ' '}
              </span>
              <Button type="submit" disabled={loading || emails.length === 0}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading
                  ? 'Sending…'
                  : `Send invite${emails.length > 1 ? `s (${emails.length})` : ''}`}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
