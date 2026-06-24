'use client';
// Client helper: verify a vendor document (GST/PAN/CIN) via the server route,
// authenticated with the vendor's Supabase session.
import { supabase } from './supabase';

export async function verifyDocument(type, value, name) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch('/api/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token}`,
    },
    body: JSON.stringify({ type, value, name }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Verification failed');
  return json; // { valid, name, status, message, nameMatch? }
}
