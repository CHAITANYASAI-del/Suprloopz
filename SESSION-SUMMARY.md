# SuperLoopz — Vendor Onboarding Platform · Build & Session Summary

**Prepared for:** Co-Founder & CTO
**Date:** 2026-06-23
**Live app:** https://suprloopz.com
- Vendor portal → `/vendor`
- Staff/Admin portal → `/admin`

---

## 1. What SuperLoopz is

A multi-tenant B2B vendor-onboarding platform. Internal **staff** invite **vendors**; each
vendor sets a password and completes a guided onboarding (**Profile → Company → Legal
documents → Address**). Staff review every vendor's data and documents and set their status.

**$0 hosting**, production-oriented, designed to scale toward ~100K registered vendors.

---

## 2. Architecture (current)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **Next.js 14 (App Router)** on **Vercel** | Single project, two path-based portals (`/vendor`, `/admin`) |
| UI | Tailwind + shadcn/ui (Orbit DS) | — |
| Auth + DB + Storage | **Supabase** (managed) | **Two separate projects** (see below) |
| Email | **Resend** | Sends vendor invite emails |
| Doc storage | Supabase Storage bucket `legal-docs` | Access via short-lived signed URLs only |

### Two fully separate systems
Staff and vendors are **independent account sets in two different Supabase projects**, so the
same email can be both a staff member and a vendor with no collision.

- **VENDOR project** — vendor auth + all vendor data + `legal-docs` storage. The `/vendor`
  portal authenticates here.
- **STAFF project** — staff auth only (no tables). The `/admin` portal authenticates
  here. *Every* account in it is staff by definition.
- The admin app reads/writes vendor data through a server route (`/api/admin`) using the vendor
  service key (bypasses row-level security), **gated by verifying the caller is a real staff
  user** in the staff project.

> History: originally targeted a self-hosted Keycloak/Postgres/MinIO stack on Oracle Cloud free
> tier. Oracle never provisioned capacity, so we pivoted to managed Supabase — no servers to run.

---

## 3. The two core flows

### A) Adding a staff member (founder/admin does this)
1. Add the person in the **Staff Supabase project** → Authentication → **Send invitation**.
2. They get an email → click the link → land on a dedicated **staff set-password page** → set
   a password → enter the admin dashboard.
3. Returning staff sign in at `/admin/login`.

### B) Inviting a vendor (staff does this, from inside the admin app)
1. Admin → **Invite vendor** → enter **one or many** emails.
2. Server creates each vendor account with a **generated temporary password** and emails it
   (via Resend) with an **activation link**.
3. Vendor clicks the link → lands on **`/vendor/activate`** with **email + temp password
   pre-filled** → clicks Continue → is signed in → **sets their own password** → onboarding.
4. Admin sees the vendor in the dashboard and can review profile, company, **legal documents
   (in-app PDF viewer)**, addresses, and set status (Active / Pending / Suspended) or
   verify/reject documents.

---

## 4. What was built/fixed in this session

Chronological, most recent first (commit hash · summary):

| Commit | Change |
|---|---|
| `982d494` | Invite results: **Copy activation link** + keep the account when the email can't be sent (lets us demo to specific people without a verified email domain) |
| `4a7f16f` | **Bulk vendor invite** — one or many emails at once, with a per-email results list |
| `c4ab7df` | **Document viewer**: in-app modal (embedded PDF) with **Fullscreen** + **New tab**; links pre-signed on load for instant open |
| `4d8bbae` | Fix doc **View** opening (popup-blocker issue) |
| `5576826` | **Speed up** set-password redirect + "Signing you in…" spinner |
| `23b9104` | Fix **vendor detail page crash** (wrong id used as link target) + robust re-click redirect |
| `1d1cff1` | Set-password pages skip the form for users who already set their password (invite-link re-click) |
| `c2a5663` | **New vendor invite model**: admin-created temp password + Resend email + autofilled `/vendor/activate` (replaced Supabase magic-link) |
| `cfac616` | **Split into two systems** — separate Vendor + Staff Supabase projects |
| `714b08e`–`e6781be` | Dedicated staff set-password page; staff/vendor routing; implicit auth flow so invite links work |

### Notable bugs found & fixed
- **Admin "vendor already exists":** a stale vendor account left over from earlier testing — not
  a flaw in the two-system separation. Cleaned up; separation verified working.
- **Vendor detail page white-screen:** the vendor list was linking to the wrong id (a joined
  table's primary key overwrote the user id). Fixed + added a graceful "not found" fallback.
- **"View" document did nothing:** the signed link opened a tab *after* an async call, so the
  browser's popup blocker killed it. Replaced with an in-app modal viewer.
- **Re-clicking an invite link re-showed set-password:** now detects an already-set account and
  redirects straight to the dashboard.

---

## 5. Current status

| Item | Status |
|---|---|
| Staff invite → set-password → admin | ✅ Working |
| Vendor invite (temp password + activation link) | ✅ Working |
| Vendor onboarding (Profile/Company/Legal/Address) | ✅ Working |
| Admin dashboard, vendor detail, doc viewer, verify/reject, status | ✅ Working |
| Bulk invite + copy-link | ✅ Working |
| Two-system separation (same email as staff & vendor) | ✅ Verified |
| Email delivery to **any** address | ✅ Live — `suprloopz.com` verified in Resend; sends from `support@suprloopz.com` |
| Custom domain | ✅ `suprloopz.com` (`/` coming-soon, `/admin`, `/vendor`) |

---

## 6. Known limitations / next steps

1. **Resend domain verification — ✅ done.** `suprloopz.com` is verified in Resend and invite
   emails send from `support@suprloopz.com` to any recipient. (Optional: set up GoDaddy email
   forwarding so replies to `support@` land in an inbox.)

2. **Rotate secrets before launch.** Several keys (Supabase service keys, Resend keys) were
   shared during development and should be regenerated, with the new values set only in Vercel
   environment variables — never committed.

3. **Minor cleanup.** Some superseded admin helper functions remain in `db.js` (no longer used);
   safe to remove.

---

## 7. Environment variables (names only — values live in Vercel)

```
# Vendor Supabase project
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SECRET_KEY            # server-only

# Staff Supabase project
NEXT_PUBLIC_STAFF_SUPABASE_URL
NEXT_PUBLIC_STAFF_SUPABASE_ANON_KEY
STAFF_SUPABASE_SECRET_KEY     # server-only

# App + email
NEXT_PUBLIC_SITE_URL          # https://suprloopz.com
RESEND_API_KEY                # server-only
RESEND_FROM_EMAIL
```

---

## 8. Key paths (for engineers)

| Path | Purpose |
|---|---|
| `frontend/src/app/vendor/activate/page.jsx` | Vendor activation (autofilled login from invite link) |
| `frontend/src/app/vendor/reset-password/page.jsx` | Vendor sets own password |
| `frontend/src/app/admin/set-password/page.jsx` | Staff sets own password |
| `frontend/src/app/api/admin/route.js` | Server admin API (list/get/invite/verify docs/signed URLs) |
| `frontend/src/lib/serverSupabase.js` | Server clients + `verifyStaff` gate |
| `frontend/src/lib/adminApi.js` | Client → `/api/admin` helper |
| `frontend/src/components/admin/InviteVendorDialog.jsx` | Single/bulk invite UI |
| `supabase/schema.sql` | Vendor project schema: tables, RLS, storage bucket |
| `frontend/scripts/*.mjs` | One-off admin utilities (list/delete users, inspect a vendor, check a doc) |

---

*Generated from the Claude Code build session on 2026-06-23.*
