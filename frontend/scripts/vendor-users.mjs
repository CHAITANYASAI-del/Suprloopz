// One-off admin utility: list (and optionally delete) users in the VENDOR project.
// Uses the GoTrue admin REST API directly (avoids supabase-js realtime/ws on Node 20).
//   node scripts/vendor-users.mjs            -> list
//   node scripts/vendor-users.mjs del <email> -> delete that user
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const BASE = `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`;
const headers = {
  apikey: env.SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
  'Content-Type': 'application/json',
};

const [, , cmd, email] = process.argv;

const res = await fetch(`${BASE}?per_page=200`, { headers });
if (!res.ok) { console.error('listUsers error:', res.status, await res.text()); process.exit(1); }
const { users } = await res.json();

console.log(`VENDOR project users (${users.length}):`);
for (const u of users) {
  console.log(`  ${u.email}  | role=${u.app_metadata?.role || '—'} | created=${u.created_at}`);
}

if ((cmd === 'del' || cmd === 'mark') && email) {
  const target = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!target) { console.log(`\nNo user "${email}" found.`); process.exit(0); }
  if (cmd === 'del') {
    const del = await fetch(`${BASE}/${target.id}`, { method: 'DELETE', headers });
    if (!del.ok) { console.error('delete error:', del.status, await del.text()); process.exit(1); }
    console.log(`\n✅ Deleted ${email} from the VENDOR project.`);
  } else {
    const put = await fetch(`${BASE}/${target.id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ user_metadata: { ...(target.user_metadata || {}), password_set: true } }),
    });
    if (!put.ok) { console.error('update error:', put.status, await put.text()); process.exit(1); }
    console.log(`\n✅ Marked ${email} as password_set in the VENDOR project.`);
  }
}
