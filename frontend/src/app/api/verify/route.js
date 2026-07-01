// Vendor-facing document verification. Gated to a logged-in vendor. Uses the active
// provider (Surepass) with a credit budget: once the budget is spent, it falls back
// to manual admin review instead of calling the provider.
import { verifyVendor, vendorAdmin } from '@/lib/serverSupabase';
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

  // Format-only pass: a global dev bypass, OR types not yet enabled with the provider
  // (VERIFY_SKIP, e.g. PAN while awaiting Surepass PAN access). No credit spent.
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

  // Credit budget. Once spent, fall back to manual admin review (no provider call,
  // no credit consumed) so onboarding never blocks when the quota runs out.
  const budget = Number(process.env.VERIFY_CREDIT_BUDGET || 100);
  let used = 0;
  try {
    const { data } = await vendorAdmin.from('verify_usage').select('used').eq('id', true).maybeSingle();
    used = data?.used ?? 0;
  } catch { /* table not present yet → treat as 0 */ }

  if (used >= budget) {
    return Response.json({
      valid: true,
      manual: true,
      status: 'MANUAL_REVIEW',
      name: `${(name || '').trim() || 'Submitted'} · pending manual review`,
      message: 'Automated checks are at capacity — our team will verify this document manually.',
    });
  }

  try {
    const result = await verifier({ value: clean, name });
    // A provider call was made → spend one credit.
    await vendorAdmin.rpc('consume_verify_credit').catch(() => {});
    // Record successful automated verifications so admin can show auto-verified docs.
    if (result.valid) {
      await vendorAdmin.from('verifications').insert({
        user_id: vendor.id,
        doc_type: type,
        id_number: clean,
        valid: true,
        registered_name: result.name || null,
        source: process.env.VERIFY_PROVIDER || 'surepass',
      }).catch(() => {});
    }
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e.message || 'Verification failed' }, { status: 502 });
  }
}
