// Test /corporate/cin with a REAL active CIN + retry on timeout.
//   node scripts/surepass-cin.mjs [CIN]
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const BASE = env.SUREPASS_BASE;
const H = { Authorization: `Bearer ${env.SUREPASS_TOKEN}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Infosys Ltd — a real, active CIN.
const cin = process.argv[2] || 'L85110KA1981PLC013115';

for (let attempt = 0; attempt < 3; attempt++) {
  const r = await fetch(`${BASE}/corporate/cin`, { method: 'POST', headers: H, body: JSON.stringify({ id_number: cin }) });
  const j = await r.json();
  console.log(`attempt ${attempt + 1} → ${r.status} success=${j.success} msg=${j.message || ''} name=${j.data?.company_name || '—'}`);
  if (j.success || !(r.status >= 500 || /timed out|try again/i.test(j.message || ''))) break;
  await sleep(900 * (attempt + 1));
}
