'use client';
// STAFF Supabase client (project B). The SuperLoopz team authenticates here.
// Every account in this project is staff — there are no vendors in it.
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_STAFF_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_STAFF_SUPABASE_ANON_KEY;

export const supabaseStaff = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
});
