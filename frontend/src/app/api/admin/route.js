// Consolidated admin API. The caller must be a STAFF-project user; all data
// operations run against the VENDOR project with the service key (RLS bypass).
import { vendorAdmin, verifyStaff } from '@/lib/serverSupabase';

export const runtime = 'nodejs';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
const ok = (data) => Response.json(data);
const err = (msg, status = 400) => Response.json({ error: msg }, { status });

async function listVendors() {
  const [profiles, vps, comps, oss] = await Promise.all([
    vendorAdmin.from('profiles').select('id,email,role,created_at').eq('role', 'vendor'),
    vendorAdmin.from('vendor_profiles').select('*'),
    vendorAdmin.from('companies').select('user_id,legal_name,trade_name,industry'),
    vendorAdmin.from('onboarding_status').select('*'),
  ]);
  const vp = Object.fromEntries((vps.data || []).map((r) => [r.user_id, r]));
  const c = Object.fromEntries((comps.data || []).map((r) => [r.user_id, r]));
  const o = Object.fromEntries((oss.data || []).map((r) => [r.user_id, r]));
  return (profiles.data || []).map((p) => ({
    id: p.id, email: p.email, created_at: p.created_at,
    ...(vp[p.id] || {}),
    legal_name: c[p.id]?.legal_name, trade_name: c[p.id]?.trade_name, industry: c[p.id]?.industry,
    ...(o[p.id] || {}),
  }));
}

export async function POST(req) {
  const staff = await verifyStaff(req);
  if (!staff) return err('Unauthorized', 401);

  let body;
  try { body = await req.json(); } catch { return err('Invalid body'); }
  const { action } = body || {};

  try {
    switch (action) {
      case 'list': {
        const vendors = await listVendors();
        const docs = await vendorAdmin.from('legal_documents').select('verified,file_path');
        const stats = {
          total: vendors.length,
          active: vendors.filter((v) => v.status === 'active').length,
          pending: vendors.filter((v) => !v.status || v.status === 'pending').length,
          suspended: vendors.filter((v) => v.status === 'suspended').length,
          fully_onboarded: vendors.filter((v) => v.fully_onboarded).length,
          pending_doc_reviews: (docs.data || []).filter((d) => !d.verified && d.file_path).length,
        };
        return ok({ vendors, stats });
      }
      case 'get': {
        const id = body.userId;
        const [profile, company, onboarding, documents, addresses, prof] = await Promise.all([
          vendorAdmin.from('vendor_profiles').select('*').eq('user_id', id).maybeSingle(),
          vendorAdmin.from('companies').select('*').eq('user_id', id).maybeSingle(),
          vendorAdmin.from('onboarding_status').select('*').eq('user_id', id).maybeSingle(),
          vendorAdmin.from('legal_documents').select('*').eq('user_id', id).order('doc_type'),
          vendorAdmin.from('addresses').select('*').eq('user_id', id).order('type'),
          vendorAdmin.from('profiles').select('id,email,role,created_at').eq('id', id).maybeSingle(),
        ]);
        return ok({
          user: prof.data, profile: profile.data, company: company.data,
          onboarding: onboarding.data, documents: documents.data || [],
          addresses: addresses.data || [], activity: [],
        });
      }
      case 'setStatus':
        await vendorAdmin.from('vendor_profiles').update({ status: body.status }).eq('user_id', body.userId);
        return ok({ ok: true });
      case 'verifyDoc':
        await vendorAdmin.from('legal_documents')
          .update({ verified: true, verified_at: new Date().toISOString() }).eq('id', body.docId);
        return ok({ ok: true });
      case 'rejectDoc':
        await vendorAdmin.from('legal_documents')
          .update({ verified: false, verified_at: null }).eq('id', body.docId);
        return ok({ ok: true });
      case 'signedUrl': {
        const { data, error } = await vendorAdmin.storage.from('legal-docs').createSignedUrl(body.path, 300);
        if (error) return err(error.message);
        return ok({ url: data.signedUrl });
      }
      case 'inviteVendor': {
        const email = (body.email || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err('A valid email is required');
        const { data, error } = await vendorAdmin.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${siteUrl}/vendor/reset-password`,
          data: { role: 'vendor' },
        });
        if (error) return err(error.message, /already/i.test(error.message) ? 409 : 400);
        await vendorAdmin.auth.admin.updateUserById(data.user.id, { app_metadata: { role: 'vendor' } });
        return ok({ ok: true, email });
      }
      default:
        return err('Unknown action');
    }
  } catch (e) {
    return err(e.message || 'Server error', 500);
  }
}
