// Server-only Cashfree Verification Suite (V2) client. Verifies GSTIN, business PAN,
// and CIN against the official registries. NEVER import from a client component —
// it reads the Cashfree secret.
//
// Docs: https://www.cashfree.com/docs/api-reference/vrs/v2/end-point
const BASE = process.env.CASHFREE_VERIFY_BASE || 'https://sandbox.cashfree.com/verification';

function headers() {
  const id = process.env.CASHFREE_CLIENT_ID;
  const secret = process.env.CASHFREE_CLIENT_SECRET;
  if (!id || !secret) throw new Error('Cashfree credentials are not configured');
  return { 'x-client-id': id, 'x-client-secret': secret, 'Content-Type': 'application/json' };
}

async function call(path, body) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { httpOk: res.ok, status: res.status, data };
}

// Each verifier normalises Cashfree's response to a common shape:
//   { valid, name, status, message, nameMatch? }

export async function verifyPan({ value, name }) {
  const { data } = await call('/pan', { pan: value, name: name || undefined });
  return {
    valid: data.valid === true || data.pan_status === 'VALID',
    name: data.registered_name || null,
    status: data.pan_status || null,
    nameMatch: data.name_match_result || null,
    message: data.message || '',
  };
}

export async function verifyGstin({ value, name }) {
  const { data } = await call('/gstin', { GSTIN: value, business_name: name || undefined });
  return {
    valid: data.valid === true,
    name: data.legal_name_of_business || null,
    tradeName: data.trade_name_of_business || null,
    status: data.gst_in_status || null,
    message: data.message || '',
  };
}

export async function verifyCin({ value }) {
  const { data } = await call('/cin', { reference_id: `cin_${Date.now()}`, cin: value });
  return {
    valid: data.status === 'VALID' || data.cin_status === 'ACTIVE',
    name: data.company_name || null,
    status: data.cin_status || data.status || null,
    message: data.message || '',
  };
}

export const VERIFIERS = { PAN: verifyPan, GST: verifyGstin, CIN: verifyCin };
