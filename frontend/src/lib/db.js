'use client';
// Supabase data access. Vendor calls are RLS-scoped to the signed-in user;
// staff (admin/support) calls see everything via RLS.
import { supabase } from './supabase';

async function uid() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}
async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

// ---------------- Vendor onboarding ----------------
export const db = {
  async onboarding() {
    const id = await uid();
    const [os, vp] = await Promise.all([
      supabase.from('onboarding_status').select('*').eq('user_id', id).maybeSingle(),
      supabase.from('vendor_profiles').select('*').eq('user_id', id).maybeSingle(),
    ]);
    return { onboarding: os.data, profile: vp.data };
  },

  async saveProfile({ firstName, lastName, phone }) {
    const id = await uid();
    const { error } = await supabase.from('vendor_profiles')
      .upsert({ user_id: id, first_name: firstName, last_name: lastName, phone, onboarding_step: 2 }, { onConflict: 'user_id' });
    if (error) throw error;
    await supabase.from('onboarding_status').update({ profile_completed: true }).eq('user_id', id);
  },

  async getCompany() {
    const id = await uid();
    const { data } = await supabase.from('companies').select('*').eq('user_id', id).maybeSingle();
    return data;
  },

  async saveCompany(c) {
    const id = await uid();
    const row = {
      user_id: id, legal_name: c.legalName, trade_name: c.tradeName, registration_number: c.registrationNumber,
      incorporation_date: c.incorporationDate || null, industry: c.industry, vendor_type: c.vendorType,
      vendor_category: c.vendorCategory, years_in_business: c.yearsInBusiness, number_of_employees: c.numberOfEmployees,
      annual_turnover: c.annualTurnover, website: c.website, company_email: c.companyEmail, company_speciality: c.companySpeciality,
    };
    const { error } = await supabase.from('companies').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
    await supabase.from('vendor_profiles').update({ onboarding_step: 3 }).eq('user_id', id);
    await supabase.from('onboarding_status').update({ company_info_completed: true }).eq('user_id', id);
  },

  async uploadLegal(docType, file) {
    const id = await uid();
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    const path = `${id}/${docType}/${safe}`;
    const { error } = await supabase.storage.from('legal-docs').upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  },

  async saveLegal(docs) {
    const id = await uid();
    const rows = docs.map((d) => ({
      user_id: id, doc_type: d.docType, doc_name: d.docName, doc_number: d.docNumber,
      file_path: d.filePath, verified: false, verified_at: null, verified_by: null,
    }));
    const { error } = await supabase.from('legal_documents').upsert(rows, { onConflict: 'user_id,doc_type' });
    if (error) throw error;
    await supabase.from('vendor_profiles').update({ onboarding_step: 4 }).eq('user_id', id);
    await supabase.from('onboarding_status').update({ legal_docs_completed: true }).eq('user_id', id);
  },

  async getDocuments() {
    const id = await uid();
    const { data } = await supabase.from('legal_documents').select('*').eq('user_id', id).order('doc_type');
    return data || [];
  },

  async saveAddress({ registered, sameAsBilling, billing, shipping }) {
    const id = await uid();
    const bill = sameAsBilling ? registered : billing;
    const mk = (type, a) => ({
      user_id: id, type, street_address: a.streetAddress, city: a.city, state: a.state,
      postal_code: a.postalCode, country: a.country,
    });
    const { error } = await supabase.from('addresses')
      .upsert([mk('registered', registered), mk('billing', bill), mk('shipping', shipping)], { onConflict: 'user_id,type' });
    if (error) throw error;
    await supabase.from('vendor_profiles').update({ onboarding_step: 5, status: 'active' }).eq('user_id', id);
    await supabase.from('onboarding_status')
      .update({ address_completed: true, fully_onboarded: true, completed_at: new Date().toISOString() }).eq('user_id', id);
  },

  async getAddresses() {
    const id = await uid();
    const { data } = await supabase.from('addresses').select('*').eq('user_id', id).order('type');
    return data || [];
  },

  // ---------------- Admin (staff, RLS sees all) ----------------
  async invite(email, role = 'vendor') {
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
      body: JSON.stringify({ email, role }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(json.error || 'Invite failed'), { status: res.status });
    return json;
  },

  async listVendors() {
    const [profiles, vps, comps, oss] = await Promise.all([
      supabase.from('profiles').select('id,email,role,created_at').eq('role', 'vendor'),
      supabase.from('vendor_profiles').select('*'),
      supabase.from('companies').select('user_id,legal_name,trade_name,industry'),
      supabase.from('onboarding_status').select('*'),
    ]);
    const vpById = Object.fromEntries((vps.data || []).map((r) => [r.user_id, r]));
    const cById = Object.fromEntries((comps.data || []).map((r) => [r.user_id, r]));
    const oById = Object.fromEntries((oss.data || []).map((r) => [r.user_id, r]));
    return (profiles.data || []).map((p) => ({
      id: p.id, email: p.email, created_at: p.created_at,
      ...(vpById[p.id] || {}),
      legal_name: cById[p.id]?.legal_name, trade_name: cById[p.id]?.trade_name, industry: cById[p.id]?.industry,
      ...(oById[p.id] || {}),
    }));
  },

  async stats() {
    const v = await this.listVendors();
    const docs = await supabase.from('legal_documents').select('verified,file_path');
    return {
      total: v.length,
      active: v.filter((x) => x.status === 'active').length,
      pending: v.filter((x) => x.status === 'pending' || !x.status).length,
      suspended: v.filter((x) => x.status === 'suspended').length,
      fully_onboarded: v.filter((x) => x.fully_onboarded).length,
      pending_doc_reviews: (docs.data || []).filter((d) => !d.verified && d.file_path).length,
    };
  },

  async getVendor(userId) {
    const [profile, company, onboarding, documents, addresses, prof] = await Promise.all([
      supabase.from('vendor_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('companies').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('onboarding_status').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('legal_documents').select('*').eq('user_id', userId).order('doc_type'),
      supabase.from('addresses').select('*').eq('user_id', userId).order('type'),
      supabase.from('profiles').select('id,email,role,created_at').eq('id', userId).maybeSingle(),
    ]);
    return {
      user: prof.data, profile: profile.data, company: company.data, onboarding: onboarding.data,
      documents: documents.data || [], addresses: addresses.data || [], activity: [],
    };
  },

  async setVendorStatus(userId, status) {
    const { error } = await supabase.from('vendor_profiles').update({ status }).eq('user_id', userId);
    if (error) throw error;
  },

  async verifyDoc(docId) {
    const me = await uid();
    const { error } = await supabase.from('legal_documents')
      .update({ verified: true, verified_at: new Date().toISOString(), verified_by: me }).eq('id', docId);
    if (error) throw error;
  },

  async rejectDoc(docId) {
    const { error } = await supabase.from('legal_documents')
      .update({ verified: false, verified_at: null, verified_by: null }).eq('id', docId);
    if (error) throw error;
  },

  async signedDocUrl(path) {
    const { data, error } = await supabase.storage.from('legal-docs').createSignedUrl(path, 300);
    if (error) throw error;
    return data.signedUrl;
  },
};
