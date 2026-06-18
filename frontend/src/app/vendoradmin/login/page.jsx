'use client';
import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { startSsoLogin } from '@/lib/oidc';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Staff / company portal — single-sign-on only, no in-app credentials form.
export default function AdminLoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setError('');
    setLoading(true);
    try {
      await startSsoLogin(); // redirects to Keycloak
    } catch (err) {
      setError(err.message || 'Could not start SSO sign-in.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
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
          <h1 className="text-2xl font-semibold tracking-tight">SuperLoopz staff sign-in</h1>
          <p className="mt-1 text-sm text-muted-foreground">For the SuperLoopz team and technical support.</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button className="w-full" onClick={signIn} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {loading ? 'Redirecting…' : 'Sign in with SSO'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                You&apos;ll be securely redirected to Keycloak to authenticate.
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">Secured by Keycloak SSO · SuperLoopz</p>
      </main>
    </div>
  );
}
