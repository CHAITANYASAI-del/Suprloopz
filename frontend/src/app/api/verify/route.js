// Vendor-facing document verification via Cashfree. Gated to a logged-in vendor so
// the Cashfree credentials/quota can't be abused. Verifies GST / PAN / CIN.
import { verifyVendor } from '@/lib/serverSupabase';
import { getVerifiers } from '@/lib/verify';
import { docNumberError } from '@/lib/validators';

export const runtime = 'nodejs';

export async function POST(req) {
  const vendor = await verifyVendor(req);
  if (!vendor) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid body' }, { status: 400 }); }
  const { type, value, name } = body || {};

  const verifier = getVerifiers()[type];
  if (!verifier) return Response.json({ error: 'Unknown document type' }, { status: 400 });
  if (!value) return Response.json({ error: 'A document number is required' }, { status: 400 });

  const clean = String(value).toUpperCase().replace(/\s+/g, '');

  // Format-only pass for a global dev bypass, OR for specific types not yet enabled
  // with the provider (VERIFY_SKIP, e.g. "PAN" while awaiting Surepass PAN access).
  const skip = (process.env.VERIFY_SKIP || '').toUpperCase().split(',').map((s) => s.trim());
  const bypass = process.env.VERIFY_DEV_BYPASS === 'true' || process.env.CASHFREE_DEV_BYPASS === 'true';
  if (bypass || skip.includes(type)) {
    const fmt = docNumberError(type, clean);
    if (fmt) return Response.json({ valid: false, message: fmt });
    return Response.json({
      valid: true,
      name: `${(name || '').trim() || 'Format valid'} · verification pending`,
      status: 'FORMAT_ONLY',
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
