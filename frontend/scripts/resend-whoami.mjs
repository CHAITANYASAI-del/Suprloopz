// Reveals which Resend account the local RESEND_API_KEY belongs to. In test mode
// (no verified domain) Resend rejects sends to any address other than the account
// owner's, and the error names that owner — so a probe send tells us whose key it is.
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
// Optional: pass a key as the first arg to probe a different account than .env.local.
const key = process.argv[2] || env.RESEND_API_KEY || '';
console.log('local RESEND_API_KEY (masked):', key.slice(0, 8) + '…' + key.slice(-4));
console.log('from:', env.RESEND_FROM_EMAIL);

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    to: ['whoami-probe@example.com'],
    subject: 'probe', html: '<p>probe</p>',
  }),
});
console.log('status:', res.status);
console.log('response:', await res.text());
