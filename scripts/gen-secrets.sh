#!/usr/bin/env bash
# Generates strong production secrets for SuperLoopz and prints them as env vars
# ready to paste into Coolify. Run locally — do NOT commit the output.
#
#   bash scripts/gen-secrets.sh
set -euo pipefail

rand() { LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "${1:-40}"; echo; }

cat <<EOF
# ---- Generated secrets ($(date -u +%Y-%m-%dT%H:%MZ)) — paste into Coolify ----
POSTGRES_PASSWORD=$(rand 40)
REDIS_PASSWORD=$(rand 40)
KEYCLOAK_CLIENT_SECRET=$(rand 48)
KEYCLOAK_ADMIN_PASSWORD=$(rand 32)
MINIO_SECRET_KEY=$(rand 48)
JWT_SECRET=$(rand 64)
# -----------------------------------------------------------------------------
# Reminders:
#  * Set KEYCLOAK_CLIENT_SECRET as the secret on the 'superloopz-backend' client
#    in the Keycloak admin console (Clients -> superloopz-backend -> Credentials).
#  * Keep this output out of git. It is shown once.
EOF
