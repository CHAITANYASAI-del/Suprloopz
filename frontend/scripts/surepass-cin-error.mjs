// Captures the full CIN API request + response for a Surepass support ticket.
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const BASE = env.SUREPASS_BASE;
const URL_ = `${BASE}/corporate/cin`;
const H = { Authorization: `Bearer ${env.SUREPASS_TOKEN}`, 'Content-Type': 'application/json' };

// Real, active CINs (public companies) — none of these should be "invalid".
const CINS = ['L85110KA1981PLC013115', 'L22210MH1995PLC084781'];

for (const cin of CINS) {
  const t0 = Date.now();
  const res = await fetch(URL_, { method: 'POST', headers: H, body: JSON.stringify({ id_number: cin }) });
  const body = await res.text();
  console.log('────────────────────────────────────────');
  console.log('Time (UTC)   :', new Date().toISOString());
  console.log('Endpoint     : POST', URL_);
  console.log('Request body :', JSON.stringify({ id_number: cin }));
  console.log('HTTP status  :', res.status, res.statusText);
  console.log('Latency      :', Date.now() - t0, 'ms');
  console.log('Response body:', body);
}
