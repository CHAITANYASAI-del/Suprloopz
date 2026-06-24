'use client';
// Portal-aware auth. The admin portal (/admin) authenticates against the
// STAFF Supabase project; everything else uses the VENDOR project. The two
// sessions are fully independent, so the same email can be a staff member and a
// vendor at the same time.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from './supabase';
import { supabaseStaff } from './supabaseStaff';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const pathname = usePathname() || '';
  const isAdmin = pathname.startsWith('/admin');
  const client = isAdmin ? supabaseStaff : supabase;

  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    setReady(false);
    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = client.auth.onAuthStateChange((_e, s) => active && setSession(s));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [client]);

  const signOut = async () => {
    await client.auth.signOut();
    setSession(null);
    router.push(isAdmin ? '/admin/login' : '/vendor/login');
  };

  const user = useMemo(() => {
    const u = session?.user;
    if (!u) return null;
    // Role is implied by which system you're in.
    return { id: u.id, email: u.email, role: isAdmin ? 'admin' : 'vendor' };
  }, [session, isAdmin]);

  const value = useMemo(
    () => ({ ready, session, user, isAuthenticated: !!session, signOut, logout: signOut }),
    [ready, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
