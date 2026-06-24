# Suprloopz — Vendor Onboarding

Multi-tenant B2B vendor onboarding for **Suprloopz**. Internal **staff** invite
**vendors**; each vendor signs in with a temporary password, sets their own, and
completes a guided onboarding (**Profile → Company → Legal documents → Address**).
Staff review every vendor's data and documents and manage their status.

**Live:** https://suprloopz.com
- `/` → landing placeholder ("coming soon")
- `/admin` → staff / company admin portal
- `/vendor` → vendor portal

## Stack

| Layer | Tool |
|------|------|
| Frontend + server routes | **Next.js 14 (App Router)** on **Vercel** |
| UI | Tailwind + shadcn/ui (Orbit DS) |
| Auth + Database + Storage | **Supabase** (managed) — two separate projects |
| Email | **Resend** (sends from `support@suprloopz.com`) |
| Domain | `suprloopz.com` (GoDaddy DNS → Vercel) |

> The app is **serverless / $0-host**: Vercel for the app, Supabase managed for
> auth/DB/storage, Resend for email. No servers to run.

### Two fully separate systems
Staff and vendors are **independent account sets in two different Supabase
projects**, so the same email can be both a staff member and a vendor with no
collision.

- **Vendor project** — vendor auth + all vendor data + the `legal-docs` storage
  bucket. The `/vendor` portal authenticates here.
- **Staff project** — staff auth only (no tables). The `/admin` portal
  authenticates here; every account in it is staff by definition.
- The admin app reads/writes vendor data through the server route
  **`/api/admin`** using the vendor service key (bypasses RLS), gated by
  verifying the caller is a real staff user in the staff project.

## Repository layout

```
.
├── frontend/                       # the live app (Next.js) — everything runs here
│   ├── src/app/
│   │   ├── page.jsx                # "/" coming-soon placeholder
│   │   ├── admin/                  # staff portal (dashboard, vendors, login, set-password)
│   │   ├── vendor/                 # vendor portal (activate, reset-password, onboarding/*)
│   │   └── api/admin/route.js      # server admin API (list/get/invite/resend/delete/verify docs/signed URLs)
│   ├── src/lib/                    # supabase (vendor + staff) clients, serverSupabase, adminApi,
│   │   │                           #   auth context, adminData (notifications), email, routes
│   ├── src/components/admin/       # invite dialog, invited actions, notifications (bell + toasts)
│   └── scripts/*.mjs               # one-off admin utilities (list/delete/mark users, inspect vendor, resend probes)
├── supabase/schema.sql             # vendor project: tables, RLS, handle_new_user trigger, legal-docs bucket
└── (legacy) backend/ infra/ deploy/ docker-compose.yml
                                    # ABANDONED self-hosted Keycloak/Postgres/MinIO/Oracle stack — not used
```

## The flows

### Adding a staff member
1. Add the person in the **staff Supabase project** → Authentication → **Send invitation**.
2. They get an email → click the link → land on `/admin/set-password` → set a password → enter the admin dashboard.
3. Returning staff sign in at `/admin/login`.

### Inviting a vendor (from the admin app)
1. Admin → **Invite vendor** → enter one or many emails.
2. The server creates each vendor account with a **generated temporary password** and emails it (via Resend) with an **activation link**.
3. Vendor clicks the link → `/vendor/activate` validates it and signs them in → `/vendor/reset-password` to set their own password → onboarding.
4. **Acceptance** = the vendor's first sign-in. Un-accepted invites live under **Vendors → Invited** (with **Resend** / **Revoke**); accepted ones move to **Active vendors**.
5. Admin reviews profile, company, legal documents (in-app PDF viewer with signed URLs), addresses; verifies/rejects documents; sets status (Active / Pending / Suspended). A **notification bell + toasts** announce when a vendor accepts.

## Local development

```bash
cd frontend
npm install
npm run dev            # http://localhost:3001
```

Requires `frontend/.env.local` (gitignored) with the vars below.

## Environment variables

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
RESEND_FROM_EMAIL             # Suprloopz <support@suprloopz.com>
```

Set the same values in **Vercel → Settings → Environment Variables** (Production +
Preview), and **redeploy** after any change.

## Supabase setup

1. Run `supabase/schema.sql` in the **vendor** project's SQL editor (tables, RLS,
   `handle_new_user` trigger, `legal-docs` storage bucket).
2. **Auth → URL Configuration** on each project:
   - Staff: Site URL `https://suprloopz.com/admin/set-password`, Redirect URLs `https://suprloopz.com/**`
   - Vendor: Site URL `https://suprloopz.com/vendor`, Redirect URLs `https://suprloopz.com/**`
3. Disable public sign-ups on both (accounts are invite/dashboard-created). Auth
   uses the **implicit** flow so server-generated invite/recovery links work.

## Email (Resend)

`suprloopz.com` is verified in Resend (SPF/DKIM/DMARC via GoDaddy), so invite
emails deliver to any recipient from `Suprloopz <support@suprloopz.com>`.

## Deployment

Push to `main` → Vercel auto-builds and deploys `frontend/` to `suprloopz.com`.
Nothing else to deploy (Supabase + Resend are managed).
