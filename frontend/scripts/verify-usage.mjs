// Confirms the verification tables/function exist and resets the credit counter.
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const U = env.NEXT_PUBLIC_SUPABASE_URL;
const K = env.SUPABASE_SECRET_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };

async function j(path, opts = {}) {
  const r = await fetch(`${U}/rest/v1/${path}`, { headers: H, ...opts });
  const t = await r.text();
  return { status: r.status, body: t };
}

console.log('verify_usage :', (await j('verify_usage?select=*')).body);
console.log('verifications:', (await j('verifications?select=*&limit=1')).body);

// Test the RPC (increments), then reset to 0 so the counter is clean for testing.
const rpc = await fetch(`${U}/rest/v1/rpc/consume_verify_credit`, { method: 'POST', headers: H, body: '{}' });
console.log('consume_verify_credit RPC:', rpc.status, await rpc.text());

const reset = await fetch(`${U}/rest/v1/verify_usage?id=eq.true`, {
  method: 'PATCH', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify({ used: 0 }),
});
console.log('reset used→0:', reset.status, await reset.text());
