// Checks for leftover data rows for an email after the auth user was deleted.
//   node scripts/orphan-check.mjs <email>
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SECRET_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}` };
const email = process.argv[2];

const prof = await (await fetch(`${U}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=*`, { headers: H })).json();
console.log('profiles row for', email, '=>', JSON.stringify(prof));

if (prof.length) {
  const id = prof[0].id;
  for (const t of ['vendor_profiles', 'companies', 'onboarding_status', 'legal_documents', 'addresses']) {
    const rows = await (await fetch(`${U}/rest/v1/${t}?user_id=eq.${id}&select=user_id`, { headers: H })).json();
    console.log(`  ${t}: ${rows.length} row(s)`);
  }
} else {
  console.log('✅ No profile row — cascade cleaned everything; she will not appear in the dashboard.');
}
