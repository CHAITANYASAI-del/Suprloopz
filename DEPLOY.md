# SuperLoopz — Production Deployment ($0, Oracle Cloud + Coolify)

This is the one-time runbook to take the backend stack live. The **frontend is
already on Vercel** (`https://superloopzvendor.vercel.app`). This guide deploys
**everything else** — Backend API, Keycloak, PostgreSQL, Redis, MinIO — onto a
single **Oracle Cloud Always-Free** VPS managed by **Coolify**.

**Total cost: $0.** Every piece below has a free tier — including the domains
and HTTPS certificates.

```
Browser ──► Vercel (frontend, /vendor + /vendoradmin)
              │  calls api.* and auth.* over HTTPS
              ▼
        Oracle Free VPS (Coolify)
        backend · keycloak · postgres · redis · minio
              │
              ▼
        Cloudflare R2 (images)  ·  Resend (email)   ← managed, free
```

---

## Phase 1 — Oracle Cloud Always-Free VPS (free)

1. Sign up at https://cloud.oracle.com (credit card is for verification only —
   Always-Free resources never charge).
2. Create a compute instance:
   - Shape: **Ampere A1 (ARM)** — Always Free allows up to **4 OCPU / 24 GB**.
     Use **2 OCPU / 12 GB** (plenty for this stack).
   - Image: **Ubuntu 22.04**.
   - Assign a **public IPv4**.
   - Add your SSH public key.
3. Open the firewall (both places):
   - Oracle **VCN → Security List**: allow ingress TCP **22, 80, 443**.
   - On the box: `sudo iptables -I INPUT -p tcp -m multiport --dports 80,443 -j ACCEPT` (Oracle Ubuntu images block these by default), then persist with `netfilter-persistent save`.
4. Note the **public IP** — you'll need it next.

## Phase 2 — Install Coolify (free, open source)

SSH in and run the official installer:
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```
Open `http://<VPS_IP>:8000`, create the admin account. Coolify now manages
Docker, reverse-proxy, and Let's Encrypt TLS for you.

## Phase 3 — Pick free HTTPS hostnames (no domain purchase)

You need three subdomains for `backend`, `keycloak`, `minio`. Two free routes —
both get **real Let's Encrypt HTTPS** via Coolify:

- **sslip.io (zero signup)** — encodes your IP. If IP = `132.145.10.20`:
  - `api.132-145-10-20.sslip.io`
  - `auth.132-145-10-20.sslip.io`
  - `files.132-145-10-20.sslip.io`
- **DuckDNS (free, nicer names)** — register at https://www.duckdns.org, point
  `api-superloopz`, `auth-superloopz`, `files-superloopz` at your VPS IP →
  `api-superloopz.duckdns.org`, etc.

> When you later buy a real domain (e.g. `superloopz.com`), just point
> `api./auth./files.` at the VPS and update the env + Keycloak — nothing else changes.

## Phase 4 — Generate secrets

On your laptop, in the repo:
```bash
bash scripts/gen-secrets.sh
```
Copy the output — you'll paste these into Coolify in the next step. Also fill in
`RESEND_API_KEY` (your real key) and the Cloudflare R2 keys (optional).

## Phase 5 — Deploy the stack in Coolify

1. Coolify → **+ New → Resource → Docker Compose** → connect GitHub → pick
   `CHAITANYASAI-del/Superloopz-Vendor-Onboarding`, branch `main`.
2. Set **Compose file** = `docker-compose.prod.yml`.
3. **Environment variables:** paste everything from
   [.env.prod.example](.env.prod.example), replacing `__GENERATE__` with the
   secrets from Phase 4 and the hostnames from Phase 3.
4. **Assign domains** (Coolify → each service → Domains):
   | Service | Domain | Port |
   |---|---|---|
   | `backend` | `https://api.<your-free-host>` | 3000 |
   | `keycloak` | `https://auth.<your-free-host>` | 8080 |
   | `minio` | `https://files.<your-free-host>` | 9000 |
   Coolify auto-issues Let's Encrypt certs for each.
5. **Deploy.** Postgres/Redis/Keycloak/MinIO start; the backend runs DB
   migrations (all tables + RLS) automatically on boot; Keycloak imports the
   `superloopz` realm (roles + clients).

## Phase 6 — Finish Keycloak setup

1. Open `https://auth.<your-free-host>` → admin console → log in with
   `KEYCLOAK_ADMIN_USERNAME` / `KEYCLOAK_ADMIN_PASSWORD`.
2. Realm `superloopz` → Clients → **superloopz-backend** → Credentials → set the
   secret to your `KEYCLOAK_CLIENT_SECRET`.
3. Clients → **superloopz-web** → confirm **Valid redirect URIs** + **Web
   origins** include `https://superloopzvendor.vercel.app/*` and the origin
   (the realm export already ships these).

## Phase 7 — Seed a staff admin

Coolify → `backend` service → **Terminal**:
```bash
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='ChangeMe#2026' npm run seed
```
That creates a SuperLoopz admin (Keycloak user + `admin` role + DB row).

## Phase 8 — Point Vercel at the live backend

Vercel → your project → Settings → Environment Variables → set:
```
NEXT_PUBLIC_API_URL            = https://api.<your-free-host>
NEXT_PUBLIC_KEYCLOAK_URL       = https://auth.<your-free-host>
NEXT_PUBLIC_KEYCLOAK_REALM     = superloopz
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID = superloopz-web
```
Then **Redeploy** (Deployments → ⋯ → Redeploy). The frontend now talks to the
live backend.

## Phase 9 — Keep it production-healthy (free)

- **Avoid Oracle idle reclaim:** add a cron so the instance never looks idle:
  ```bash
  (crontab -l 2>/dev/null; echo "*/10 * * * * cat /dev/urandom | head -c 1m | gzip > /dev/null") | crontab -
  ```
  Plus free uptime pings on `https://api.<host>/health` and
  `https://auth.<host>/health/ready` (e.g. UptimeRobot free).
- **Daily DB backup** to Oracle Object Storage (free 10 GB):
  ```bash
  0 2 * * * docker exec superloopz-prod-postgres-1 pg_dump -U superloopz superloopz | gzip > /backups/superloopz-$(date +\%F).sql.gz
  ```
- Coolify already restarts containers on crash/reboot (`restart: unless-stopped`).

## Phase 10 — Verify end-to-end

| Check | URL |
|---|---|
| API health | `https://api.<host>/health` → `{"status":"ok"}` |
| Keycloak ready | `https://auth.<host>/health/ready` |
| OIDC discovery | `https://auth.<host>/realms/superloopz/.well-known/openid-configuration` |
| Staff portal | `https://superloopzvendor.vercel.app/vendoradmin` → SSO → admin panel |
| Vendor portal | `https://superloopzvendor.vercel.app/vendor` |

Then: sign in to `/vendoradmin` → **Invite a vendor** → they get the Resend
email → they sign in at `/vendor`, reset password, complete onboarding. Done —
production, $0.
