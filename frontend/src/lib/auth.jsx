'use client';
// Client-side auth context. Decodes the JWT to expose role + identity and
// persists tokens via the api module's storage helpers.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getTokens, setTokens } from './api';

const AuthContext = createContext(null);

function decodeJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

function deriveUser(tokens) {
  if (!tokens?.accessToken) return null;
  const p = decodeJwt(tokens.accessToken);
  if (!p) return null;
  const roles = p.realm_access?.roles || [];
  const role = roles.includes('admin')
    ? 'admin'
    : roles.includes('support')
      ? 'support'
      : 'vendor';
  return { sub: p.sub, email: p.email || p.preferred_username, role };
}

export function AuthProvider({ children }) {
  const [tokens, setTokensState] = useState(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setTokensState(getTokens());
    setReady(true);
  }, []);

  const applyTokens = (t) => {
    setTokens(t);
    setTokensState(t);
  };

  const logout = async () => {
    const t = getTokens();
    if (t?.refreshToken) await api.logout(t.refreshToken).catch(() => {});
    applyTokens(null);
    // Return to the login of whichever portal the user is currently in.
    const onAdmin =
      typeof window !== 'undefined' && window.location.pathname.startsWith('/vendoradmin');
    router.push(onAdmin ? '/vendoradmin/login' : '/vendor/login');
  };

  const value = useMemo(
    () => ({
      ready,
      tokens,
      user: deriveUser(tokens),
      isAuthenticated: !!tokens?.accessToken,
      setTokens: applyTokens,
      logout,
    }),
    [tokens, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
