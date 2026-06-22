// One-off admin utility for the STAFF project (GoTrue admin REST API).
//   node scripts/staff-users.mjs              -> list
//   node scripts/staff-users.mjs mark <email> -> set user_metadata.password_set=true
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

const BASE = `${env.NEXT_PUBLIC_STAFF_SUPABASE_URL}/auth/v1/admin/users`;
const headers = {
  apikey: env.STAFF_SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${env.STAFF_SUPABASE_SECRET_KEY}`,
  'Content-Type': 'application/json',
};

const [, , cmd, email] = process.argv;

const res = await fetch(`${BASE}?per_page=200`, { headers });
if (!res.ok) { console.error('listUsers error:', res.status, await res.text()); process.exit(1); }
const { users } = await res.json();

console.log(`STAFF project users (${users.length}):`);
for (const u of users) {
  console.log(`  ${u.email}  | password_set=${u.user_metadata?.password_set || false} | created=${u.created_at}`);
}

if (cmd === 'mark' && email) {
  const target = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!target) { console.log(`\nNo user "${email}" found.`); process.exit(0); }
  const put = await fetch(`${BASE}/${target.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ user_metadata: { ...(target.user_metadata || {}), password_set: true } }),
  });
  if (!put.ok) { console.error('update error:', put.status, await put.text()); process.exit(1); }
  console.log(`\n✅ Marked ${email} as password_set — re-clicking the invite link now skips set-password.`);
}
