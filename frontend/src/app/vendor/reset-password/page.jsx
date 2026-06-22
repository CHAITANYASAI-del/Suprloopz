'use client';
// Landing page for the Supabase invite / password-recovery email link.
// Supabase establishes a session from the link (detectSessionInUrl); the vendor
// then sets their password and continues to onboarding.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check, X } from 'lucide-react';
import { supabase, roleOf } from '@/lib/supabase';
import { routes } from '@/lib/routes';
import { Logo } from '@/components/Logo';
import { Field } from '@/components/Field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const rules = [
  { test: (p) => p.length >= 12, label: 'At least 12 characters' },
  { test: (p) => /[0-9]/.test(p), label: 'Contains a number' },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: 'Contains a special character' },
];

export default function SetPasswordPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState(null); // null = checking
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // The invite link puts a session in the URL; give Supabase a moment to parse it.
    const decide = async (session) => {
      if (!session) { setHasSession(false); return; }
      // A staff member who landed here gets sent to the staff set-password page.
      if (roleOf(session.user) !== 'vendor') {
        router.replace(routes.adminSetPassword);
        return;
      }
      // A vendor who already set their password and re-opens the link resumes in
      // their portal instead of seeing the form again.
      // Fast path: cached session already shows the flag → redirect instantly.
      if (session.user?.user_metadata?.password_set) {
        router.replace(routes.vendorHome);
        return;
      }
      // Slow path: a cached session can predate the flag → confirm with the server.
      const { data } = await supabase.auth.getUser();
      if (data?.user?.user_metadata?.password_set) {
        router.replace(routes.vendorHome);
        return;
      }
      setHasSession(true);
    };
    supabase.auth.getSession().then(({ data }) => decide(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => decide(s));
    return () => sub.subscription.unsubscribe();
  }, [router]);

  const allValid = rules.every((r) => r.test(newPassword));

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    setFormError('');
    if (!allValid) return setErrors({ newPassword: 'Password does not meet the requirements' });
    if (newPassword !== confirmPassword) return setErrors({ confirmPassword: 'Passwords do not match' });

    setLoading(true);
    // Tag the account so a later re-click of the invite link skips this page.
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { password_set: true },
    });
    setLoading(false);
    if (error) {
      setFormError(error.message || 'Could not set your password.');
      return;
    }
    // Staff → admin dashboard; vendors → onboarding.
    const role = roleOf(data.user);
    router.push(role === 'vendor' ? routes.onboarding('profile') : routes.adminHome);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-navy text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <Logo light />
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-col px-4 py-16">
        {hasSession === null ? (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Signing you in…</p>
          </div>
        ) : (
        <>
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Set your password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose a strong password to secure your account.</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {hasSession === false && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>
                  This link is invalid or expired. Please use the invitation email link, or{' '}
                  <a href={routes.vendorLogin} className="font-medium underline">sign in</a>.
                </AlertDescription>
              </Alert>
            )}
            <form onSubmit={submit} className="space-y-4" noValidate>
              {formError && (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
              <Field label="New password" htmlFor="newPassword" error={errors.newPassword} required>
                <Input id="newPassword" type="password" autoComplete="new-password"
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)} aria-invalid={!!errors.newPassword} />
              </Field>
              <ul className="space-y-1">
                {rules.map((r) => {
                  const ok = r.test(newPassword);
                  return (
                    <li key={r.label} className="flex items-center gap-2 text-xs">
                      {ok ? <Check className="h-3.5 w-3.5 text-green-600" /> : <X className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className={ok ? 'text-green-700' : 'text-muted-foreground'}>{r.label}</span>
                    </li>
                  );
                })}
              </ul>
              <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword} required>
                <Input id="confirmPassword" type="password" autoComplete="new-password"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} aria-invalid={!!errors.confirmPassword} />
              </Field>
              <Button type="submit" className="w-full" disabled={loading || hasSession === false}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Saving…' : 'Set password & continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
        </>
        )}
      </main>
    </div>
  );
}
