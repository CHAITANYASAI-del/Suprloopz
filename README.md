# SuperLoopz — Vendor Onboarding

Multi-tenant B2B vendor onboarding for **SuperLoopz**, the universal AI-native
commerce operating system. Built to the exact stack in
`SuperLoopz_Complete_Tech_Stack_v4.docx` — every service self-hosted and free,
designed to run on the Oracle Cloud Always-Free VPS via Coolify.

| Layer | Tool | Where |
|------|------|------|
| Auth | Keycloak (OIDC/JWT) | self-hosted (Docker) |
| Database | PostgreSQL 16 + Row Level Security | self-hosted (Docker) |
| Cache / rate limit / idempotency | Redis 7 | self-hosted (Docker) |
| Legal doc storage | MinIO (S3-compatible) | self-hosted (Docker) |
| Public asset storage | Cloudflare R2 (S3-compatible) | managed |
| Backend API | Node.js + Express | Docker |
| Frontend | Next.js + **Orbit DS** (shadcn/ui + Tailwind) | Docker |
| Email | Resend (5 transactional templates) | managed |
| Admin panel | Retool (PostgreSQL + Keycloak) — plus this repo's `/admin` UI | managed |

## Repository layout

```
.
├── docker-compose.yml         # full local stack
├── .env.example               # all environment variables (copy to .env)
├── infra/
│   ├── postgres/init/         # creates the Keycloak database on first boot
│   └── keycloak/realm-export.json   # realm, roles (vendor/admin/support), clients
├── backend/                   # Node.js + Express API
│   ├── migrations/001_init.sql      # schema + RLS policies
│   └── src/
│       ├── config, db, redis, keycloak, storage, email
│       ├── middleware/        # auth (JWT), rateLimit, idempotency, validate, upload
│       ├── validation/        # zod schemas
│       └── routes/            # auth, admin, onboarding, vendor, files
└── frontend/                  # Next.js App Router
    └── src/
        ├── components/ui/      # Orbit/shadcn primitives
        ├── lib/                # api client, auth context, dropdown options
        └── app/                # login, reset-password, onboarding/*, dashboard, admin/*
```

## Quick start (local, Docker)

```bash
cp .env.example .env           # adjust secrets as needed
docker compose up -d --build   # postgres, redis, keycloak, minio, backend, frontend
```

Then, once Keycloak is healthy, seed an admin so you can send invites:

```bash
docker compose exec backend npm run seed
# → creates admin@superloopz.com / SuperLoopzAdmin#1  (override via SEED_ADMIN_* env)
```

Services:

| URL | What |
|-----|------|
| http://localhost:3001 | Frontend (Next.js) |
| http://localhost:3000/health | Backend API health |
| http://localhost:8080 | Keycloak admin console (`admin` / `admin`) |
| http://localhost:9001 | MinIO console |

> The backend container runs migrations automatically on start
> (`node src/db/migrate.js`). To run them manually: `docker compose exec backend npm run migrate`.

## Running the apps without Docker

```bash
# Backend (needs Postgres, Redis, Keycloak, MinIO reachable per .env)
cd backend && npm install && npm run migrate && npm run dev

# Frontend
cd frontend && npm install && npm run dev   # http://localhost:3000
```

## The onboarding flow

1. **Admin invites** — `POST /api/admin/vendors/invite` creates the user in
   Keycloak with a temporary password + forced `UPDATE_PASSWORD`, writes the
   `users` row, and emails the invite via Resend.
2. **Login** — vendor signs in; Keycloak reports the pending password update, so
   the API returns `passwordResetRequired` and the UI routes to `/reset-password`.
3. **Reset password** — min 12 chars, a digit and a special char; Keycloak
   clears the required action and the vendor is logged straight in.
4. **Profile** → **Company** → **Legal (GST/PAN/CIN to MinIO)** → **Address** —
   each step persists and advances `onboarding_status`. Completing the address
   step flips `fully_onboarded`, activates the vendor, and sends the welcome email.
5. **Support/Admin** review everything at `/admin/vendors` and can verify/reject
   documents (which emails the vendor).

## Security (as specified)

- **Row Level Security on every table.** Each request opens a transaction and
  sets `app.current_user_id` + `app.user_role`; policies (with `FORCE ROW LEVEL
  SECURITY`) ensure a vendor can only ever touch their own rows. See
  `backend/migrations/001_init.sql` and `backend/src/db/pool.js`.
- **Passwords live only in Keycloak** — never in PostgreSQL.
- **JWT** verified against the realm JWKS; 15-min access tokens with refresh
  rotation (`revokeRefreshToken` + `refreshTokenMaxReuse: 0`).
- **Rate limiting** (Redis sliding window) on the whole `/api` surface, tighter
  on auth routes.
- **Idempotency keys** on invite + onboarding completion (Redis-backed replay).
- **Input validation + sanitization** via zod on every endpoint.
- **Parameterized queries only** — no string-concatenated SQL.
- **Signed-URL-only file access** — no public buckets; legal docs server-side
  encrypted in MinIO under `legal/{user_id}/{doc_type}/{filename}`.
- **Uploads** capped at 5MB, restricted to PNG/JPEG/PDF.

## Environment variables

See `.env.example` — it is the single source of truth and documents every
variable (database, Redis, Keycloak, MinIO, Cloudflare R2, Resend, JWT, CORS,
rate limits, frontend API URL).

## Deploying on Oracle Cloud + Coolify

This `docker-compose.yml` maps 1:1 onto Coolify resources. Deploy
PostgreSQL/Redis/Keycloak/MinIO as Coolify services, point the backend and
frontend at them via Coolify environment variables, and front everything with
Cloudflare for HTTPS/CDN/DDoS. R2 + Resend are managed and reached over the
public internet with the credentials in `.env`.
