'use client';
// Admin data access (staff portal). Calls /api/admin with the staff session
// token; the server performs everything against the vendor project.
import { supabaseStaff } from './supabaseStaff';

async function call(action, payload = {}) {
  const { data } = await supabaseStaff.auth.getSession();
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || 'Request failed'), { status: res.status });
  return json;
}

export const adminApi = {
  async listVendors() {
    return (await call('list')).vendors;
  },
  async stats() {
    return (await call('list')).stats;
  },
  getVendor: (userId) => call('get', { userId }),
  setVendorStatus: (userId, status) => call('setStatus', { userId, status }),
  verifyDoc: (docId) => call('verifyDoc', { docId }),
  rejectDoc: (docId) => call('rejectDoc', { docId }),
  async signedDocUrl(path) {
    return (await call('signedUrl', { path })).url;
  },
  invite: (email) => call('inviteVendor', { email }),
};
