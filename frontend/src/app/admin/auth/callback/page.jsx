'use client';
// Legacy OIDC callback route — no longer used with Supabase Auth.
// Kept as a harmless redirect so old links don't 404.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { routes } from '@/lib/routes';

export default function AuthCallbackRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(routes.adminHome);
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">Signing you in…</div>
  );
}
