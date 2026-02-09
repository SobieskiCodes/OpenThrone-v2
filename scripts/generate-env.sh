#!/usr/bin/env bash
# =============================================================================
# Generate a production .env for the PRODUCTION_ENV GitHub secret.
#
# Usage:
#   bash scripts/generate-env.sh YOUR_DROPLET_IP
#
# Then copy the output and paste it as the PRODUCTION_ENV secret in GitHub.
# =============================================================================
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: bash scripts/generate-env.sh YOUR_DROPLET_IP"
  exit 1
fi

DROPLET_IP="$1"
JWT_SECRET=$(openssl rand -base64 32)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
DB_PASSWORD="openthrone"  # Change this for real production

cat << EOF
# === Copy everything below into the PRODUCTION_ENV GitHub secret ===

# Database (PostgreSQL running in Docker on the same droplet)
DATABASE_URL="postgresql://openthrone:${DB_PASSWORD}@localhost:5432/openthrone?schema=public"

# Auth
JWT_SECRET="${JWT_SECRET}"
JWT_EXPIRY="15m"
JWT_REFRESH_EXPIRY="30d"

# NextAuth (frontend)
NEXTAUTH_URL="http://${DROPLET_IP}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"

# API
API_URL="http://localhost:3001"
NEXT_PUBLIC_API_URL="http://${DROPLET_IP}/api"
CORS_ORIGIN="http://${DROPLET_IP}"
PORT=3001

# CAPTCHA (disabled until you set up Turnstile)
ENABLE_CAPTCHA="false"
NEXT_PUBLIC_TURNSTILE_SITE_ID=""
TURNSTILE_SECRET=""

# Feature Toggles
ENABLE_ATTACKING="true"
ENABLE_INTEL="true"
ENABLE_ASSASSINATIONS="true"
ENABLE_INFILTRATIONS="true"
ENABLE_MESSAGING="true"
ENABLE_REGISTRATION="true"

# Scheduled Jobs
ENABLE_TURN_UPDATES="true"
ENABLE_DAILY_UPDATES="true"

# === End — copy everything above ===
EOF
