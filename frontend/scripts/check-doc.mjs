// Verifies a legal-docs storage object exists and that a signed URL resolves.
//   node scripts/check-doc.mjs "<file_path>"
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const path = process.argv[2];

// 1) List objects in the bucket root prefix folders to see what's actually stored.
const userPrefix = path.split('/')[0];
const list = await fetch(`${URL_}/storage/v1/object/list/legal-docs`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ prefix: '', limit: 100, sortBy: { column: 'name', order: 'asc' } }),
});
console.log('bucket root entries:', JSON.stringify(await list.json(), null, 2));

const list2 = await fetch(`${URL_}/storage/v1/object/list/legal-docs`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ prefix: userPrefix, limit: 100 }),
});
console.log(`\nunder "${userPrefix}":`, JSON.stringify(await list2.json(), null, 2));

// 2) Try to create a signed URL for the exact path.
const sign = await fetch(`${URL_}/storage/v1/object/sign/legal-docs/${path}`, {
  method: 'POST', headers: H, body: JSON.stringify({ expiresIn: 300 }),
});
const signBody = await sign.text();
console.log(`\nsign status ${sign.status}:`, signBody);
if (sign.ok) {
  const { signedURL } = JSON.parse(signBody);
  const full = `${URL_}/storage/v1${signedURL}`;
  const get = await fetch(full, { method: 'HEAD' });
  console.log('signed URL HEAD status:', get.status, 'content-type:', get.headers.get('content-type'));
}
