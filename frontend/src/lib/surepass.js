// Server-only Surepass KYC/KYB client for GSTIN, business PAN, and CIN verification.
// NEVER import from a client component — it reads the Surepass token.
//
// Auth: Bearer token (a long-lived JWT issued in the Surepass dashboard).
// Base URL: sandbox by default; set SUREPASS_BASE to the production URL to go live.
// NOTE: endpoint paths + response field names follow Surepass's documented KYB APIs.
// If your dashboard shows slightly different paths/fields, tweak them here only —
// the route, UI, and gating don't change.
const BASE = process.env.SUREPASS_BASE || 'https://sandbox.surepass.io/api/v1';

function headers() {
  const token = process.env.SUREPASS_TOKEN;
  if (!token) throw new Error('Surepass token is not configured');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function call(path, body) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  return { httpOk: res.ok, status: res.status, json };
}

// Surepass wraps results as { data, success, status_code, message, message_code }.
const okData = (json) => (json && json.success === true ? json.data || {} : null);

export async function verifyGstin({ value }) {
  const { json } = await call('/corporate/gstin', { id_number: value });
  const d = okData(json);
  return {
    valid: !!(d && (d.gstin || d.legal_name)),
    name: d?.legal_name || d?.business_name || null,
    tradeName: d?.additional_trade_name || null,
    status: d?.gstin_status || null,
    message: json?.message || (d ? '' : 'GSTIN not found'),
  };
}

export async function verifyPan({ value }) {
  const { json } = await call('/pan/pan-comprehensive', { id_number: value });
  const d = okData(json);
  return {
    valid: !!(d && (d.pan_number || d.full_name)),
    name: d?.full_name || d?.registered_name || null,
    status: d?.category || null, // Individual / Company
    message: json?.message || (d ? '' : 'PAN not found'),
  };
}

export async function verifyCin({ value }) {
  const { json } = await call('/corporate/cin', { id_number: value });
  const d = okData(json);
  return {
    valid: !!(d && (d.company_name || d.cin_number)),
    name: d?.company_name || null,
    status: d?.company_status || null,
    message: json?.message || (d ? '' : 'CIN not found'),
  };
}

export const VERIFIERS = { GST: verifyGstin, PAN: verifyPan, CIN: verifyCin };
