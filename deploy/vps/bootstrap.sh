#!/usr/bin/env bash
# =============================================================================
# SuperLoopz — one-command production bootstrap for a bare Ubuntu VPS
# (Oracle Cloud free tier). Run as root on the fresh server:
#
#   curl -fsSL https://raw.githubusercontent.com/CHAITANYASAI-del/Superloopz-Vendor-Onboarding/main/deploy/vps/bootstrap.sh | sudo bash
#
# It is idempotent — safe to re-run. It:
#   * adds swap (so a 1 GB box can run the full stack)
#   * opens the host firewall for 80/443
#   * installs Docker + compose
#   * clones the repo and generates strong secrets + sslip.io HTTPS hostnames
#   * brings up Postgres, Redis, Keycloak, MinIO, the API, and Caddy (auto-TLS)
# Frontend stays on Vercel.
# =============================================================================
set -euo pipefail

REPO_URL="https://github.com/CHAITANYASAI-del/Superloopz-Vendor-Onboarding.git"
APP_DIR="/opt/superloopz"
ENV_FILE="$APP_DIR/.env.vps"

log() { echo -e "\n\033[1;36m==> $*\033[0m"; }

# ---- 0. Public IP + sslip.io hostnames -------------------------------------
log "Detecting public IP"
IP="$(curl -fsSL https://api.ipify.org || curl -fsSL ifconfig.me)"
DASH="${IP//./-}"
API_HOST="api.${DASH}.sslip.io"
AUTH_HOST="auth.${DASH}.sslip.io"
FILES_HOST="files.${DASH}.sslip.io"
echo "IP=$IP  ->  $API_HOST / $AUTH_HOST / $FILES_HOST"

# ---- 1. Swap (1 GB box needs it) -------------------------------------------
if ! swapon --show | grep -q /swapfile; then
  log "Creating 3 GB swap"
  fallocate -l 3G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=3072
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=20 >/dev/null
fi

# ---- 2. Host firewall (Oracle Ubuntu blocks 80/443 by default) -------------
log "Opening host firewall for 80/443"
iptables -I INPUT 1 -p tcp -m multiport --dports 80,443 -j ACCEPT || true
(netfilter-persistent save 2>/dev/null) || (apt-get install -y iptables-persistent && netfilter-persistent save) || true

# ---- 3. Docker -------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker"
  apt-get update -y
  apt-get install -y ca-certificates curl git
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
fi

# ---- 4. Code ---------------------------------------------------------------
log "Fetching SuperLoopz code"
if [ -d "$APP_DIR/.git" ]; then git -C "$APP_DIR" pull --ff-only; else git clone --depth 1 "$REPO_URL" "$APP_DIR"; fi

# ---- 5. Secrets + env (generated once, kept on the box) --------------------
rnd() { LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "${1:-40}"; }
if [ ! -f "$ENV_FILE" ]; then
  log "Generating secrets + env"
  cat > "$ENV_FILE" <<EOF
# Generated $(date -u). Keep secret.
POSTGRES_USER=superloopz
POSTGRES_PASSWORD=$(rnd 40)
POSTGRES_DB=superloopz
KEYCLOAK_DB=keycloak
REDIS_PASSWORD=$(rnd 40)
KEYCLOAK_REALM=superloopz
KEYCLOAK_CLIENT_ID=superloopz-backend
KEYCLOAK_CLIENT_SECRET=$(rnd 48)
KEYCLOAK_PUBLIC_CLIENT_ID=superloopz-web
KEYCLOAK_ADMIN_USERNAME=admin
KEYCLOAK_ADMIN_PASSWORD=$(rnd 28)
KEYCLOAK_HOSTNAME=$AUTH_HOST
KEYCLOAK_PUBLIC_URL=https://$AUTH_HOST
MINIO_ACCESS_KEY=superloopz_minio
MINIO_SECRET_KEY=$(rnd 44)
MINIO_BUCKET_LEGAL_DOCS=superloopz-legal-docs
MINIO_PUBLIC_URL=https://$FILES_HOST
RESEND_API_KEY=re_GZi9gKvP_Kizxxb6cYH9RfQWUy9WnPn4A
RESEND_FROM_EMAIL=SuperLoopz <onboarding@resend.dev>
APP_BASE_URL=https://superloopzvendor.vercel.app
CORS_ORIGINS=https://superloopzvendor.vercel.app
JWT_SECRET=$(rnd 64)
API_HOST=$API_HOST
AUTH_HOST=$AUTH_HOST
FILES_HOST=$FILES_HOST
EOF
fi
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

# ---- 6. Caddy reverse proxy (auto-HTTPS via Let's Encrypt + sslip.io) -------
log "Writing Caddyfile"
mkdir -p "$APP_DIR/deploy/vps"
cat > "$APP_DIR/deploy/vps/Caddyfile" <<EOF
{
  email admin@${DASH}.sslip.io
}
$API_HOST {
  reverse_proxy backend:3000
}
$AUTH_HOST {
  reverse_proxy keycloak:8080
}
$FILES_HOST {
  reverse_proxy minio:9000
}
EOF

# ---- 7. Compose (memory-limited for 1 GB) ----------------------------------
log "Writing docker-compose.vps.yml"
cat > "$APP_DIR/deploy/vps/docker-compose.vps.yml" <<'YML'
name: superloopz
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    mem_limit: 256m
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      KEYCLOAK_DB: ${KEYCLOAK_DB}
    volumes:
      - pg:/var/lib/postgresql/data
      - ../../infra/postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 12
    networks: [sl]
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    mem_limit: 96m
    command: ["redis-server","--appendonly","yes","--requirepass","${REDIS_PASSWORD}","--maxmemory","48mb","--maxmemory-policy","allkeys-lru"]
    volumes: [redis:/data]
    networks: [sl]
  keycloak:
    image: quay.io/keycloak/keycloak:25.0
    restart: unless-stopped
    mem_limit: 700m
    command: ["start","--optimized=false","--import-realm"]
    environment:
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/${KEYCLOAK_DB}
      KC_DB_USERNAME: ${POSTGRES_USER}
      KC_DB_PASSWORD: ${POSTGRES_PASSWORD}
      KEYCLOAK_ADMIN: ${KEYCLOAK_ADMIN_USERNAME}
      KEYCLOAK_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD}
      KC_HOSTNAME: ${KEYCLOAK_HOSTNAME}
      KC_HOSTNAME_STRICT: "false"
      KC_PROXY_HEADERS: xforwarded
      KC_HTTP_ENABLED: "true"
      JAVA_OPTS_APPEND: "-Xms192m -Xmx384m"
    volumes:
      - ../../infra/keycloak/realm-export.json:/opt/keycloak/data/import/realm-export.json:ro
    depends_on:
      postgres: { condition: service_healthy }
    networks: [sl]
  minio:
    image: minio/minio:latest
    restart: unless-stopped
    mem_limit: 256m
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
      MINIO_SERVER_URL: ${MINIO_PUBLIC_URL}
    volumes: [minio:/data]
    networks: [sl]
  minio-init:
    image: minio/mc:latest
    depends_on: [minio]
    entrypoint: >
      /bin/sh -c "sleep 8; mc alias set local http://minio:9000 ${MINIO_ACCESS_KEY} ${MINIO_SECRET_KEY}; mc mb --ignore-existing local/${MINIO_BUCKET_LEGAL_DOCS}; echo bucket-ready"
    networks: [sl]
  backend:
    build: { context: ../../backend }
    restart: unless-stopped
    mem_limit: 256m
    environment:
      NODE_ENV: production
      PORT: "3000"
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      KEYCLOAK_URL: ${KEYCLOAK_PUBLIC_URL}
      KEYCLOAK_REALM: ${KEYCLOAK_REALM}
      KEYCLOAK_CLIENT_ID: ${KEYCLOAK_CLIENT_ID}
      KEYCLOAK_CLIENT_SECRET: ${KEYCLOAK_CLIENT_SECRET}
      KEYCLOAK_PUBLIC_CLIENT_ID: ${KEYCLOAK_PUBLIC_CLIENT_ID}
      KEYCLOAK_ADMIN_USERNAME: ${KEYCLOAK_ADMIN_USERNAME}
      KEYCLOAK_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD}
      MINIO_ENDPOINT: ${MINIO_PUBLIC_URL}
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
      MINIO_BUCKET_LEGAL_DOCS: ${MINIO_BUCKET_LEGAL_DOCS}
      RESEND_API_KEY: ${RESEND_API_KEY}
      RESEND_FROM_EMAIL: ${RESEND_FROM_EMAIL}
      APP_BASE_URL: ${APP_BASE_URL}
      CORS_ORIGINS: ${CORS_ORIGINS}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }
    networks: [sl]
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    mem_limit: 96m
    ports: ["80:80","443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_cfg:/config
    depends_on: [backend, keycloak, minio]
    networks: [sl]
volumes: { pg: {}, redis: {}, minio: {}, caddy_data: {}, caddy_cfg: {} }
networks: { sl: {} }
YML

# ---- 8. Launch -------------------------------------------------------------
log "Building + starting the stack (first run takes a few minutes)"
cd "$APP_DIR/deploy/vps"
docker compose --env-file "$ENV_FILE" -f docker-compose.vps.yml up -d --build

log "Done. Admin password is in $ENV_FILE (KEYCLOAK_ADMIN_PASSWORD)."
cat <<EOF

============================================================
  SuperLoopz is starting up. Public URLs:
    API     : https://$API_HOST/health
    Auth    : https://$AUTH_HOST
    Files   : https://$FILES_HOST
  HTTPS certs are issued automatically (give it ~1-2 min).
  Frontend (Vercel): set these env vars + redeploy:
    NEXT_PUBLIC_API_URL=https://$API_HOST
    NEXT_PUBLIC_KEYCLOAK_URL=https://$AUTH_HOST
============================================================
EOF
