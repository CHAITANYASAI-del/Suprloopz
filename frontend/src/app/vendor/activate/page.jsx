'use client';
// Landing page for the vendor invitation button. The invite email links here with
// the email + temporary password as query params. We validate the link on load by
// signing in with the temp password: success → straight to set-password; failure
// (invite revoked, already used, or bad link) → a clear "no longer valid" screen.
// The vendor never sees a credentials form.
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { routes } from '@/lib/routes';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

function ActivateForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const email = params.get('email');
    const tp = params.get('tp');
    if (!email || !tp) {
      setInvalid(true);
      return;
    }
    let active = true;
    supabase.auth.signInWithPassword({ email, password: tp }).then(({ error }) => {
      if (!active) return;
      if (error) setInvalid(true);
      else router.replace(routes.vendorReset); // signed in → set your own password
    });
    return () => {
      active = false;
    };
  }, [params, router]);

  if (!invalid) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="mt-3 text-sm">Signing you in…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <Card>
        <CardContent className="space-y-4 pt-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Invitation no longer valid</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This invitation link has expired or was revoked by an administrator. If you&apos;ve already
              set up your account, sign in below. Otherwise, please reach out to your Suprloopz
              administrator to request a new invitation.
            </p>
          </div>
          <a href={routes.vendorLogin}>
            <Button variant="outline" className="w-full">
              Go to sign in
            </Button>
          </a>
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-xs text-muted-foreground">Secured by Supabase Auth · Suprloopz</p>
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
