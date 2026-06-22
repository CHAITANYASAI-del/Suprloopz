// Dumps exactly what the admin "get" action returns for a vendor, to find nulls.
//   node scripts/inspect-vendor.mjs <email-or-id>
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY;
const authHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const arg = process.argv[2];
// Resolve id from email if needed.
let id = arg;
if (arg?.includes('@')) {
  const r = await fetch(`${URL_}/auth/v1/admin/users?per_page=200`, { headers: authHeaders });
  const { users } = await r.json();
  id = users.find((u) => u.email?.toLowerCase() === arg.toLowerCase())?.id;
  console.log('resolved id:', id);
}

async function rest(path) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: authHeaders });
  if (!r.ok) return { __error: `${r.status} ${await r.text()}` };
  return r.json();
}

const tables = {
  profiles: `profiles?id=eq.${id}&select=*`,
  vendor_profiles: `vendor_profiles?user_id=eq.${id}&select=*`,
  companies: `companies?user_id=eq.${id}&select=*`,
  onboarding_status: `onboarding_status?user_id=eq.${id}&select=*`,
  legal_documents: `legal_documents?user_id=eq.${id}&select=*`,
  addresses: `addresses?user_id=eq.${id}&select=*`,
};

for (const [name, path] of Object.entries(tables)) {
  console.log(`\n=== ${name} ===`);
  console.log(JSON.stringify(await rest(path), null, 2));
}
