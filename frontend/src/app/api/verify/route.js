// Vendor-facing document verification via Cashfree. Gated to a logged-in vendor so
// the Cashfree credentials/quota can't be abused. Verifies GST / PAN / CIN.
import { verifyVendor } from '@/lib/serverSupabase';
import { VERIFIERS } from '@/lib/cashfree';

export const runtime = 'nodejs';

export async function POST(req) {
  const vendor = await verifyVendor(req);
  if (!vendor) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid body' }, { status: 400 }); }
  const { type, value, name } = body || {};

  const verifier = VERIFIERS[type];
  if (!verifier) return Response.json({ error: 'Unknown document type' }, { status: 400 });
  if (!value) return Response.json({ error: 'A document number is required' }, { status: 400 });

  try {
    const result = await verifier({ value: String(value).toUpperCase().replace(/\s+/g, ''), name });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e.message || 'Verification failed' }, { status: 502 });
  }
}
