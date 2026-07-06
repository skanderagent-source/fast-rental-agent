#!/usr/bin/env bash
# Phase 21: Deploy frontend to Vercel
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${VERCEL_ORG_ID:?Set VERCEL_ORG_ID}"
: "${VERCEL_PROJECT_ID:?Set VERCEL_PROJECT_ID}"

echo "Deploying frontend to Vercel…"
npx vercel deploy --prod --yes \
  --build-env VITE_API_BASE_URL="${VITE_API_BASE_URL:-}" \
  --build-env VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-}" \
  --build-env VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-}" \
  --build-env VITE_PUBLIC_SITE_URL="${VITE_PUBLIC_SITE_URL:-}"

echo "✓ Deployed. Update Supabase redirect URLs, FRONTEND_ORIGIN, and R2 CORS with production URL."
