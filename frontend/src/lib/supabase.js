'use client';
// Browser Supabase client (publishable/anon key). All vendor-facing data access
// goes through this with Row Level Security enforcing per-vendor isolation.
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // needed for invite / password-recovery links
    flowType: 'pkce',
  },
});

// Role lives in the JWT's app_metadata (set when the admin invites the user).
export function roleOf(user) {
  const r = user?.app_metadata?.role;
  return r === 'admin' || r === 'support' ? r : 'vendor';
}
