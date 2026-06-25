// Vendor-facing document verification via Cashfree. Gated to a logged-in vendor so
// the Cashfree credentials/quota can't be abused. Verifies GST / PAN / CIN.
import { verifyVendor } from '@/lib/serverSupabase';
import { VERIFIERS } from '@/lib/cashfree';
import { docNumberError } from '@/lib/validators';

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

  const clean = String(value).toUpperCase().replace(/\s+/g, '');

  // Dev bypass: while Cashfree access is pending, accept any correctly-FORMATTED
  // number so the onboarding flow can be tested end-to-end. Off in real prod.
  if (process.env.CASHFREE_DEV_BYPASS === 'true') {
    const fmt = docNumberError(type, clean);
    if (fmt) return Response.json({ valid: false, message: fmt });
    return Response.json({
      valid: true,
      name: `${(name || '').trim() || 'Verified'} · dev mode (not verified)`,
      status: 'DEV_BYPASS',
      dev: true,
    });
  }

  try {
    const result = await verifier({ value: clean, name });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e.message || 'Verification failed' }, { status: 502 });
  }
}
