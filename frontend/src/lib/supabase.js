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

// Invited users are tagged role='vendor'. Any other signed-in account (created
// in the Supabase dashboard by the team) is staff/admin.
export function roleOf(user) {
  if (!user) return null;
  return user.app_metadata?.role === 'vendor' ? 'vendor' : 'admin';
}
