// Browser API client for the SuperLoopz backend.
// Attaches the access token, transparently refreshes once on 401, and surfaces
// a clean ApiError with field-level validation details.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const STORAGE_KEY = 'superloopz.tokens';

export function getTokens() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setTokens(tokens) {
  if (typeof window === 'undefined') return;
  if (tokens) localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  else localStorage.removeItem(STORAGE_KEY);
}

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details || [];
  }
  /** Map of field -> message, for inline form errors. */
  get fieldErrors() {
    const out = {};
    for (const d of this.details) if (d.path) out[d.path] = d.message;
    return out;
  }
}

async function refresh() {
  const tokens = getTokens();
  if (!tokens?.refreshToken) return false;
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
  if (!res.ok) {
    setTokens(null);
    return false;
  }
  const data = await res.json();
  setTokens(data.tokens);
  return true;
}

async function request(path, { method = 'GET', body, headers = {}, isForm = false, auth = true, _retry = false } = {}) {
  const tokens = getTokens();
  const finalHeaders = { ...headers };
  if (auth && tokens?.accessToken) finalHeaders.Authorization = `Bearer ${tokens.accessToken}`;

  let payload = body;
  if (body && !isForm) {
    finalHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_URL}${path}`, { method, headers: finalHeaders, body: payload });

  if (res.status === 401 && auth && !_retry) {
    const ok = await refresh();
    if (ok) return request(path, { method, body, headers, isForm, auth, _retry: true });
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.details);
  }
  return data;
}

export const api = {
  // ---- auth ----
  login: (body) => request('/api/auth/login', { method: 'POST', body, auth: false }),
  resetPassword: (body) => request('/api/auth/reset-password', { method: 'POST', body, auth: false }),
  refresh: () => refresh(),
  logout: (refreshToken) => request('/api/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }),

  // ---- onboarding ----
  onboardingStatus: () => request('/api/onboarding/status'),
  saveProfile: (body) => request('/api/onboarding/profile', { method: 'POST', body }),
  saveCompany: (body) => request('/api/onboarding/company', { method: 'POST', body }),
  uploadLegal: (formData) => request('/api/onboarding/legal/upload', { method: 'POST', body: formData, isForm: true }),
  saveLegal: (body) => request('/api/onboarding/legal/save', { method: 'POST', body }),
  saveAddress: (body, idempotencyKey) =>
    request('/api/onboarding/address', { method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey } }),

  // ---- vendor self-service ----
  vendorProfile: () => request('/api/vendor/profile'),
  vendorCompany: () => request('/api/vendor/company'),
  vendorDocuments: () => request('/api/vendor/documents'),
  vendorAddresses: () => request('/api/vendor/addresses'),

  // ---- admin ----
  adminStats: () => request('/api/admin/stats'),
  inviteVendor: (email, idempotencyKey) =>
    request('/api/admin/vendors/invite', { method: 'POST', body: { email }, headers: { 'Idempotency-Key': idempotencyKey } }),
  listVendors: (query = {}) => {
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null)).toString();
    return request(`/api/admin/vendors${qs ? `?${qs}` : ''}`);
  },
  getVendor: (id) => request(`/api/admin/vendors/${id}`),
  setVendorStatus: (id, status) => request(`/api/admin/vendors/${id}/status`, { method: 'PATCH', body: { status } }),
  verifyDoc: (id, docId) => request(`/api/admin/vendors/${id}/documents/${docId}/verify`, { method: 'POST' }),
  rejectDoc: (id, docId, reason) =>
    request(`/api/admin/vendors/${id}/documents/${docId}/reject`, { method: 'POST', body: { reason } }),

  // ---- files ----
  signedUrl: (fileKey) => request(`/api/files/signed-url/${fileKey}`),
};
