#!/usr/bin/env bash
# Phase 21: Deploy frontend to Vercel
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${VERCEL_ORG_ID:?Set VERCEL_ORG_ID}"
: "${VERCEL_PROJECT_ID:?Set VERCEL_PROJECT_ID}"

echo "Deploying frontend to Vercel…"
# Only pass --build-env for vars set in this shell. Empty values override Vercel
# project settings and produce a bundle without Supabase credentials.
BUILD_ENV_ARGS=()
for var in VITE_API_BASE_URL VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY VITE_PUBLIC_SITE_URL; do
  if [ -n "${!var:-}" ]; then
    BUILD_ENV_ARGS+=(--build-env "$var=${!var}")
  fi
done

npx vercel deploy --prod --yes "${BUILD_ENV_ARGS[@]}"

echo "✓ Deployed. Update Supabase redirect URLs, FRONTEND_ORIGIN, and R2 CORS with production URL."
