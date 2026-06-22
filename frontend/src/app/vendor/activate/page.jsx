'use client';
// Landing page for the vendor invitation button. The invite email links here with
// the email + temporary password as query params, so both fields arrive pre-filled.
// The vendor clicks "Continue", we sign them in with the temp password, then send
// them straight to the set-password step.
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { routes } from '@/lib/routes';
import { Logo } from '@/components/Logo';
import { Field } from '@/components/Field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

function ActivateForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  // Pre-fill from the invite link.
  useEffect(() => {
    setEmail(params.get('email') || '');
    setTempPassword(params.get('tp') || '');
  }, [params]);

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!email || !tempPassword) {
      setFormError('Missing email or temporary password. Please use the link from your invitation email.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: tempPassword });
    setLoading(false);
    if (error) {
      setFormError(
        'That temporary password is no longer valid. If you already set your own password, please sign in instead.',
      );
      return;
    }
    // Signed in → force them to set their own password before onboarding.
    router.replace(routes.vendorReset);
  };

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to SuperLoopz</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your credentials are filled in from your invitation. Click continue to get started.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-4" noValidate>
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {formError}{' '}
                  <a href={routes.vendorLogin} className="font-medium underline">Sign in</a>
                </AlertDescription>
              </Alert>
            )}
            <Field label="Email" htmlFor="email" required>
              <Input id="email" type="email" autoComplete="username" value={email} readOnly />
            </Field>
            <Field label="Temporary password" htmlFor="tp" required>
              <Input id="tp" type="password" autoComplete="current-password" value={tempPassword} readOnly />
            </Field>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Signing in…' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">Secured by Supabase Auth · SuperLoopz</p>
    </main>
  );
}

export default function ActivatePage() {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-navy text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <Logo light />
        </div>
      </header>
      <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-white" /></div>}>
        <ActivateForm />
      </Suspense>
    </div>
  );
}
