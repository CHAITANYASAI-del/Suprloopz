// Server route — admin invites a vendor. Uses the Supabase SECRET key (never
// exposed to the browser). Verifies the caller is an admin, then creates the
// vendor via an invite email and tags their role in app_metadata.
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';

export async function POST(req) {
  if (!secret) {
    return Response.json({ error: 'Server not configured (SUPABASE_SECRET_KEY missing)' }, { status: 500 });
  }
  const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

  // ---- authorize the caller (must be an admin) ----
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: who, error: whoErr } = await admin.auth.getUser(token);
  if (whoErr || !who?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  // Staff = any signed-in account that isn't tagged as a vendor.
  if (who.user.app_metadata?.role === 'vendor') {
    return Response.json({ error: 'Staff only' }, { status: 403 });
  }

  // ---- validate input ----
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }
  const email = (body?.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: 'A valid email is required' }, { status: 400 });
  }
  // role: 'vendor' (default) or 'admin' (staff member)
  const role = body?.role === 'admin' ? 'admin' : 'vendor';

  // ---- invite ----
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/vendor/reset-password`,
    data: { role },
  });
  if (error) {
    const status = /already/i.test(error.message) ? 409 : 400;
    return Response.json({ error: error.message }, { status });
  }
  // Tag the role in app_metadata so RLS (jwt_role / is_staff) sees it.
  await admin.auth.admin.updateUserById(data.user.id, { app_metadata: { role } });

  return Response.json({ ok: true, email, role }, { status: 201 });
}
