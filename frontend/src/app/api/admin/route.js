// Consolidated admin API. The caller must be a STAFF-project user; all data
// operations run against the VENDOR project with the service key (RLS bypass).
import { vendorAdmin, verifyStaff } from '@/lib/serverSupabase';
import { generateTempPassword, sendVendorInviteEmail } from '@/lib/email';

export const runtime = 'nodejs';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
const ok = (data) => Response.json(data);
const err = (msg, status = 400) => Response.json({ error: msg }, { status });

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Creates one vendor account with a temp password and emails the activation link.
// Returns a per-email result object (never throws) so callers can batch.
async function inviteOneVendor(rawEmail) {
  const email = (rawEmail || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { email: rawEmail, ok: false, error: 'Invalid email' };

  const tempPassword = generateTempPassword();
  const { data, error } = await vendorAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    app_metadata: { role: 'vendor' },
    user_metadata: { role: 'vendor', must_reset_password: true },
  });
  if (error) {
    const exists = /already|registered|exists/i.test(error.message);
    return { email, ok: false, error: exists ? 'Already exists' : error.message };
  }

  const activateUrl =
    `${siteUrl}/vendor/activate?email=${encodeURIComponent(email)}` +
    `&tp=${encodeURIComponent(tempPassword)}`;

  // Try to email the credentials, but keep the account even if delivery fails
  // (e.g. Resend test mode rejects non-owner addresses). The activation link is
  // returned so staff can share it manually until a sending domain is verified.
  let emailed = true;
  let emailError = null;
  try {
    await sendVendorInviteEmail({ to: email, tempPassword, activateUrl });
  } catch (e) {
    emailed = false;
    emailError = e.message;
  }
  return { email, ok: true, emailed, emailError, link: activateUrl };
}

async function listVendors() {
  const [profiles, vps, comps, oss, authList] = await Promise.all([
    vendorAdmin.from('profiles').select('id,email,role,created_at').eq('role', 'vendor'),
    vendorAdmin.from('vendor_profiles').select('*'),
    vendorAdmin.from('companies').select('user_id,legal_name,trade_name,industry'),
    vendorAdmin.from('onboarding_status').select('*'),
    vendorAdmin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const vp = Object.fromEntries((vps.data || []).map((r) => [r.user_id, r]));
  const c = Object.fromEntries((comps.data || []).map((r) => [r.user_id, r]));
  const o = Object.fromEntries((oss.data || []).map((r) => [r.user_id, r]));
  // Auth gives us the signal for "accepted": a vendor who has signed in at least
  // once (last_sign_in_at) has opened their invite. invited_at = account creation.
  const au = Object.fromEntries((authList?.data?.users || []).map((u) => [u.id, u]));
  return (profiles.data || []).map((p) => ({
    // Spread the joined rows first, then force the identity fields last so the
    // vendor_profiles / onboarding_status `id` and `user_id` columns can't clobber
    // the auth user id we link the row to.
    ...(vp[p.id] || {}),
    ...(o[p.id] || {}),
    legal_name: c[p.id]?.legal_name, trade_name: c[p.id]?.trade_name, industry: c[p.id]?.industry,
    email: p.email,
    invited_at: au[p.id]?.created_at || p.created_at,
    accepted_at: au[p.id]?.last_sign_in_at || null,
    accepted: !!au[p.id]?.last_sign_in_at,
    created_at: p.created_at,
    id: p.id,
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
        // Only accepted vendors count toward the working stats; un-accepted invites
        // are tracked separately so they don't pollute the "pending" approval count.
        const accepted = vendors.filter((v) => v.accepted);
        let creditsUsed = 0;
        try {
          const { data } = await vendorAdmin.from('verify_usage').select('used').eq('id', true).maybeSingle();
          creditsUsed = data?.used ?? 0;
        } catch { /* table not present yet */ }
        const budget = Number(process.env.VERIFY_CREDIT_BUDGET || 100);
        const stats = {
          total: accepted.length,
          invited: vendors.length - accepted.length,
          active: accepted.filter((v) => v.status === 'active').length,
          pending: accepted.filter((v) => !v.status || v.status === 'pending').length,
          suspended: accepted.filter((v) => v.status === 'suspended').length,
          fully_onboarded: accepted.filter((v) => v.fully_onboarded).length,
          pending_doc_reviews: (docs.data || []).filter((d) => !d.verified && d.file_path).length,
          verify_credits_used: creditsUsed,
          verify_credits_remaining: Math.max(0, budget - creditsUsed),
        };
        return ok({ vendors, stats });
      }
      case 'get': {
        const id = body.userId;
        const [profile, company, onboarding, documents, addresses, prof, verifs] = await Promise.all([
          vendorAdmin.from('vendor_profiles').select('*').eq('user_id', id).maybeSingle(),
          vendorAdmin.from('companies').select('*').eq('user_id', id).maybeSingle(),
          vendorAdmin.from('onboarding_status').select('*').eq('user_id', id).maybeSingle(),
          vendorAdmin.from('legal_documents').select('*').eq('user_id', id).order('doc_type'),
          vendorAdmin.from('addresses').select('*').eq('user_id', id).order('type'),
          vendorAdmin.from('profiles').select('id,email,role,created_at').eq('id', id).maybeSingle(),
          vendorAdmin.from('verifications').select('doc_type,id_number,registered_name').eq('user_id', id).eq('valid', true),
        ]);

        // Pre-sign every document link (valid 1h) so the admin's "View" is instant
        // and doesn't need a per-click round-trip.
        const docRows = documents.data || [];
        const paths = docRows.map((d) => d.file_path).filter(Boolean);
        let signed = {};
        if (paths.length) {
          const { data: urls } = await vendorAdmin.storage.from('legal-docs').createSignedUrls(paths, 3600);
          signed = Object.fromEntries((urls || []).map((u) => [u.path, u.signedUrl]));
        }
        // Flag docs that were auto-verified via the provider (match type + number).
        const norm = (s) => String(s || '').toUpperCase().replace(/\s+/g, '');
        const vmap = {};
        for (const v of verifs.data || []) vmap[`${v.doc_type}:${norm(v.id_number)}`] = v;
        const documentsWithUrls = docRows.map((d) => {
          const m = vmap[`${d.doc_type}:${norm(d.doc_number)}`];
          return { ...d, signed_url: signed[d.file_path] || null, auto_verified: !!m, verified_name: m?.registered_name || null };
        });

        return ok({
          user: prof.data, profile: profile.data, company: company.data,
          onboarding: onboarding.data, documents: documentsWithUrls,
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
        const r = await inviteOneVendor(body.email);
        if (!r.ok) return err(r.error, r.error === 'Already exists' ? 409 : 400);
        return ok({ ok: true, email: r.email });
      }
      case 'inviteVendors': {
        // Bulk invite: dedupe, then invite each (sequential to stay under email
        // rate limits). Always 200 with a per-email results array.
        const raw = Array.isArray(body.emails) ? body.emails : [];
        const emails = [...new Set(raw.map((e) => (e || '').trim().toLowerCase()).filter(Boolean))];
        if (!emails.length) return err('No emails provided');
        const results = [];
        for (const e of emails) results.push(await inviteOneVendor(e));
        return ok({ results });
      }
      case 'resendInvite': {
        // Regenerate a temp password for an existing (un-accepted) invite and re-email.
        const userId = body.userId;
        if (!userId) return err('userId is required');
        const { data: got, error: getErr } = await vendorAdmin.auth.admin.getUserById(userId);
        if (getErr || !got?.user) return err('Invite not found', 404);
        const email = got.user.email;
        const tempPassword = generateTempPassword();
        const { error: upErr } = await vendorAdmin.auth.admin.updateUserById(userId, { password: tempPassword });
        if (upErr) return err(upErr.message, 500);
        const activateUrl =
          `${siteUrl}/vendor/activate?email=${encodeURIComponent(email)}&tp=${encodeURIComponent(tempPassword)}`;
        try {
          await sendVendorInviteEmail({ to: email, tempPassword, activateUrl });
        } catch (e) {
          return err(`Could not resend the invite email: ${e.message}`, 502);
        }
        return ok({ ok: true, email });
      }
      case 'deleteVendor': {
        // Hard-delete the vendor account; the DB cascade removes all their rows
        // (profile, company, onboarding, documents, addresses) automatically.
        if (!body.userId) return err('userId is required');
        const { error } = await vendorAdmin.auth.admin.deleteUser(body.userId);
        if (error) return err(error.message, 500);
        return ok({ ok: true });
      }
      default:
        return err('Unknown action');
    }
  } catch (e) {
    return err(e.message || 'Server error', 500);
  }
}
