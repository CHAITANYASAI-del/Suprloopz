'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { completeSsoLogin } from '@/lib/oidc';
import { useAuth } from '@/lib/auth';
import { setTokens as persistTokens } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

function roleFromToken(accessToken) {
  try {
    const p = JSON.parse(atob(accessToken.split('.')[1]));
    const roles = p.realm_access?.roles || [];
    return roles.includes('admin') ? 'admin' : roles.includes('support') ? 'support' : 'vendor';
  } catch {
    return 'vendor';
  }
}

// OIDC redirect target for the staff portal. Exchanges the auth code for tokens
// and routes the user into the admin panel (rejecting non-staff).
export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { setTokens } = useAuth();
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // guard against double-invoke in StrictMode
    ran.current = true;

    const code = params.get('code');
    const state = params.get('state');
    const ssoError = params.get('error_description') || params.get('error');

    if (ssoError) {
      setError(ssoError);
      return;
    }
    if (!code) {
      setError('Missing authorization code.');
      return;
    }

    (async () => {
      try {
        const tokens = await completeSsoLogin({ code, state });
        const role = roleFromToken(tokens.accessToken);
        if (role !== 'admin' && role !== 'support') {
          persistTokens(null);
          setError('This account is not a SuperLoopz staff member.');
          return;
        }
        setTokens(tokens);
        router.replace('/admin');
      } catch (err) {
        setError(err.message || 'Sign-in failed.');
      }
    })();
  }, [params, router, setTokens]);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-navy text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <Logo light />
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col px-4 py-24">
        {error ? (
          <Card>
            <CardContent className="space-y-4 pt-6 text-center">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Button onClick={() => router.replace('/login')}>Back to sign-in</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p>Completing sign-in…</p>
          </div>
        )}
      </main>
    </div>
  );
}
