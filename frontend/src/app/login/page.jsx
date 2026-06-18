'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isAdminPortal, ADMIN_URL, VENDOR_URL } from '@/lib/portal';
import { startSsoLogin } from '@/lib/oidc';
import { Logo } from '@/components/Logo';
import { Field } from '@/components/Field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Resume onboarding at the first incomplete step.
function nextOnboardingPath(o) {
  if (!o) return '/onboarding/profile';
  if (o.fullyOnboarded) return '/dashboard';
  if (!o.profileCompleted) return '/onboarding/profile';
  if (!o.companyInfoCompleted) return '/onboarding/company';
  if (!o.legalDocsCompleted) return '/onboarding/legal';
  if (!o.addressCompleted) return '/onboarding/address';
  return '/dashboard';
}

export default function LoginPage() {
  const router = useRouter();
  const { setTokens } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);

  // Staff portal: hand off to Keycloak's hosted login (Authorization Code + PKCE).
  const signInWithSso = async () => {
    setFormError('');
    setSsoLoading(true);
    try {
      await startSsoLogin(); // redirects away
    } catch (err) {
      setFormError(err.message || 'Could not start SSO sign-in.');
      setSsoLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    setFormError('');
    if (!email) return setErrors({ email: 'Email is required' });
    if (!password) return setErrors({ password: 'Password is required' });

    setLoading(true);
    try {
      const res = await api.login({ email, password });

      if (res.passwordResetRequired) {
        // First login — Keycloak requires a password update.
        sessionStorage.setItem('superloopz.reset', JSON.stringify({ email, currentPassword: password }));
        return router.push('/reset-password');
      }

      const role = res.user?.role;
      const isStaff = role === 'admin' || role === 'support';

      // Reject the wrong audience for this portal before storing tokens.
      if (isAdminPortal && !isStaff) {
        setFormError(`This is the SuperLoopz staff portal. Vendors sign in at ${VENDOR_URL}.`);
        return;
      }
      if (!isAdminPortal && isStaff) {
        setFormError(`Staff members sign in at the admin portal: ${ADMIN_URL}.`);
        return;
      }

      setTokens(res.tokens);
      if (isAdminPortal) return router.push('/admin');
      router.push(nextOnboardingPath(res.onboarding));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setFormError('Invalid email or password');
      else setFormError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Dark header bar with SSO label in the top-left (matches the spec). */}
      <header className="bg-navy text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Logo light />
            <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-white/80">
              SSO
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-col px-4 py-16">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isAdminPortal ? 'SuperLoopz staff sign-in' : 'Sign in to SuperLoopz'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdminPortal
              ? 'For the SuperLoopz team and technical support.'
              : 'Use the credentials from your invitation email.'}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isAdminPortal ? (
              // Staff portal — single-sign-on, no in-app credentials form.
              <div className="space-y-4">
                {formError && (
                  <Alert variant="destructive">
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                <Button className="w-full" onClick={signInWithSso} disabled={ssoLoading}>
                  {ssoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {ssoLoading ? 'Redirecting…' : 'Sign in with SSO'}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  You&apos;ll be securely redirected to Keycloak to authenticate.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4" noValidate>
                {formError && (
                  <Alert variant="destructive">
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                <Field label="Email" htmlFor="email" error={errors.email} required>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!errors.email}
                  />
                </Field>
                <Field label="Password" htmlFor="password" error={errors.password} required>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={!!errors.password}
                  />
                </Field>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Secured by Keycloak SSO · SuperLoopz
        </p>
      </main>
    </div>
  );
}
