'use client';
// Auth context backed by Supabase. Tracks the session and exposes the current
// user (id, email, role) plus a signOut helper.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, roleOf } from './supabase';

const AuthContext = createContext(null);

function deriveUser(session) {
  const u = session?.user;
  if (!u) return null;
  return { id: u.id, email: u.email, role: roleOf(u) };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    const onAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/vendoradmin');
    router.push(onAdmin ? '/vendoradmin/login' : '/vendor/login');
  };

  const value = useMemo(
    () => ({
      ready,
      session,
      user: deriveUser(session),
      isAuthenticated: !!session,
      signOut,
      // kept for older call sites; Supabase manages tokens itself.
      logout: signOut,
    }),
    [session, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
