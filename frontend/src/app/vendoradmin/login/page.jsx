'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase, roleOf } from '@/lib/supabase';
import { routes } from '@/lib/routes';
import { Logo } from '@/components/Logo';
import { Field } from '@/components/Field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Staff / company portal — email + password (admin & support only).
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) return setError('Email and password are required');

    setLoading(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (err) {
      setError(err.message || 'Invalid email or password');
      return;
    }
    const role = roleOf(data.user);
    if (role !== 'admin' && role !== 'support') {
      await supabase.auth.signOut();
      setError(`This portal is for SuperLoopz staff. Vendors sign in at ${routes.vendorLogin}.`);
      return;
    }
    router.push(routes.adminHome);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-navy text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Logo light />
            <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-white/80">
              STAFF
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
            <form onSubmit={submit} className="space-y-4" noValidate>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Field label="Email" htmlFor="email" required>
                <Input id="email" type="email" autoComplete="username" placeholder="you@superloopz.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Password" htmlFor="password" required>
                <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">Secured by Supabase Auth · SuperLoopz</p>
      </main>
    </div>
  );
}
