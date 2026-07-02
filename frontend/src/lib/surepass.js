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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isTransient = (status, msg) =>
  status >= 500 || status === 429 || /timed out|try again|timeout|temporarily/i.test(msg || '');

// Call Surepass with automatic retries on transient failures (their registry backend
// can time out — the response literally says "Try Again"). Up to 3 attempts total.
async function call(path, body, attempt = 0) {
  let res;
  let json;
  try {
    res = await fetch(`${BASE}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    json = await res.json().catch(() => ({}));
  } catch (e) {
    if (attempt < 2) { await sleep(700 * (attempt + 1)); return call(path, body, attempt + 1); }
    throw e;
  }
  if (json?.success !== true && isTransient(res.status, json?.message) && attempt < 2) {
    await sleep(800 * (attempt + 1));
    return call(path, body, attempt + 1);
  }
  return { httpOk: res.ok, status: res.status, json };
}

// Surepass wraps results as { data, success, status_code, message, message_code }.
const okData = (json) => (json && json.success === true ? json.data || {} : null);
// Turn Surepass's raw failure text into something a vendor can act on.
const friendly = (msg) => {
  const m = msg || '';
  if (/timed out|try again|timeout|temporarily/i.test(m))
    return 'The government registry is temporarily slow. Please try again in a moment.';
  if (/invalid|not found|does ?n.?t exist|no record|not registered/i.test(m))
    return "We couldn't find this in the government registry — please check you uploaded the correct, genuine certificate.";
  return m;
};

export async function verifyGstin({ value }) {
  const { json } = await call('/corporate/gstin', { id_number: value });
  const d = okData(json);
  return {
    valid: !!(d && (d.gstin || d.legal_name)),
    name: d?.legal_name || d?.business_name || null,
    tradeName: d?.additional_trade_name || null,
    status: d?.gstin_status || null,
    message: d ? '' : friendly(json?.message) || 'GSTIN not found',
  };
}

export async function verifyPan({ value }) {
  const { json } = await call('/pan/pan-comprehensive', { id_number: value });
  const d = okData(json);
  return {
    valid: !!(d && (d.pan_number || d.full_name)),
    name: d?.full_name || d?.registered_name || null,
    status: d?.category || null, // Individual / Company
    message: d ? '' : friendly(json?.message) || 'PAN not found',
  };
}

export async function verifyCin({ value }) {
  const { json } = await call('/corporate/cin', { id_number: value });
  const d = okData(json);
  return {
    valid: !!(d && (d.company_name || d.cin_number)),
    name: d?.company_name || null,
    status: d?.company_status || null,
    message: d ? '' : friendly(json?.message) || 'CIN not found',
  };
}

export const VERIFIERS = { GST: verifyGstin, PAN: verifyPan, CIN: verifyCin };
