// Server-only Supabase admin clients. NEVER imported by client components.
//   vendorAdmin → full access to the VENDOR project (bypasses RLS) so staff can
//                 manage vendors even though they aren't vendor-project users.
//   verifyStaff → confirms a bearer token belongs to a real STAFF-project user.
import { createClient } from '@supabase/supabase-js';

const noPersist = { auth: { autoRefreshToken: false, persistSession: false } };

export const vendorAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  noPersist,
);

const staffAdmin = createClient(
  process.env.NEXT_PUBLIC_STAFF_SUPABASE_URL,
  process.env.STAFF_SUPABASE_SECRET_KEY,
  noPersist,
);

// Returns the staff user for a valid token, or null. Any account in the staff
// project is staff by definition (vendors live in a different project).
export async function verifyStaff(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return null;
  const { data, error } = await staffAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

// Confirms a bearer token belongs to a real VENDOR-project user.
export async function verifyVendor(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return null;
  const { data, error } = await vendorAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
