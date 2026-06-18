'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
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

export default function ResetPasswordPage() {
  const router = useRouter();
  const { setTokens } = useAuth();
  const [creds, setCreds] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('superloopz.reset');
    if (raw) setCreds(JSON.parse(raw));
  }, []);

  const allValid = rules.every((r) => r.test(newPassword));

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    setFormError('');
    if (!allValid) return setErrors({ newPassword: 'Password does not meet the requirements' });
    if (newPassword !== confirmPassword) return setErrors({ confirmPassword: 'Passwords do not match' });
    if (!creds) return setFormError('Your session expired. Please sign in again.');

    setLoading(true);
    try {
      const res = await api.resetPassword({
        email: creds.email,
        currentPassword: creds.currentPassword,
        newPassword,
        confirmPassword,
      });
      sessionStorage.removeItem('superloopz.reset');
      if (res.tokens) setTokens(res.tokens);
      router.push('/onboarding/profile');
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      setFormError(err.message || 'Could not update your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-navy text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <Logo light />
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-col px-4 py-16">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a strong password to secure your account.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {!creds && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>
                  Session expired.{' '}
                  <a href="/login" className="font-medium underline">
                    Return to sign in
                  </a>
                  .
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
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  aria-invalid={!!errors.newPassword}
                />
              </Field>

              <ul className="space-y-1">
                {rules.map((r) => {
                  const ok = r.test(newPassword);
                  return (
                    <li key={r.label} className="flex items-center gap-2 text-xs">
                      {ok ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className={ok ? 'text-green-700' : 'text-muted-foreground'}>{r.label}</span>
                    </li>
                  );
                })}
              </ul>

              <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword} required>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-invalid={!!errors.confirmPassword}
                />
              </Field>

              <Button type="submit" className="w-full" disabled={loading || !creds}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
