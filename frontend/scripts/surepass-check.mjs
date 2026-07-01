// Probe the Surepass sandbox to confirm exact endpoint paths + response shapes.
//   node scripts/surepass-check.mjs
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const BASE = env.SUREPASS_BASE;
const H = { Authorization: `Bearer ${env.SUREPASS_TOKEN}`, 'Content-Type': 'application/json' };

async function probe(path, body) {
  try {
    const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
    const t = await r.text();
    console.log(`\n=== POST ${path}  (${r.status}) ===`);
    console.log(t.slice(0, 1200));
  } catch (e) {
    console.log(`\n=== POST ${path}  ERROR: ${e.message} ===`);
  }
}

console.log('BASE =', BASE);
// GSTIN (corporate-gstin). Surepass sandbox commonly uses this test GSTIN.
await probe('/corporate/gstin', { id_number: '29AAICA3918J1ZA' });
// CIN via company-details.
await probe('/corporate/company-details', { id_number: 'U74899DL1994PLC062449' });
// Dedicated corporate CIN endpoint (may or may not exist).
await probe('/corporate/cin', { id_number: 'U74899DL1994PLC062449' });
