'use client';
// VENDOR Supabase client (project A). Vendors authenticate here and read/write
// their own rows via RLS. Each Supabase project uses its own storage key
// (sb-<ref>-auth-token), so the vendor and staff sessions never collide.
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit', // server-generated email links (invite/recovery)
  },
});

// In the vendor system every signed-in user is a vendor.
export function roleOf() {
  return 'vendor';
}
