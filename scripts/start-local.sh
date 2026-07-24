#!/usr/bin/env bash
# Start Fast Rental locally: setup checks + backend + frontend dev servers.
# Does NOT start Union Rental (:4001 API, :5174 web) — run that from its own repo.
#
# Usage:
#   npm run start:local
#   bash scripts/start-local.sh
#   bash scripts/start-local.sh --skip-db        # skip migration push
#   bash scripts/start-local.sh --skip-install   # skip npm install
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SKIP_DB=0
SKIP_INSTALL=0
for arg in "$@"; do
  case "$arg" in
    --skip-db) SKIP_DB=1 ;;
    --skip-install) SKIP_INSTALL=1 ;;
    -h|--help)
      sed -n '2,9p' "$0"
      exit 0
      ;;
    *) echo "Unknown option: $arg (try --help)" >&2; exit 1 ;;
  esac
done

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  local code=$?
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [[ $code -ne 0 ]]; then
    echo ""
    echo "Stopped dev servers (exit $code)."
  fi
}
trap cleanup EXIT INT TERM

fail() {
  local step="$1"
  local hint="$2"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "FAILED at step: $step"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "$hint"
  exit 1
}

warn() {
  local step="$1"
  local hint="$2"
  echo ""
  echo "⚠ WARNING at step: $step (continuing anyway)"
  echo "$hint"
}

step() {
  echo ""
  echo "▶ [$1] $2"
}

run() {
  "$@" || return 1
}

# ── 1. Node ──────────────────────────────────────────────────────────────────
step "1/7" "Node.js (from .nvmrc)"
if ! NODE_VER="$(bash scripts/with-node.sh node -v 2>&1)"; then
  fail "1/7 Node.js" \
    "Could not run Node.\nDebug:\n  - Install Node 22+ or nvm: https://github.com/nvm-sh/nvm\n  - Then: nvm install 22 && nvm alias default 22\n  - Or run: bash scripts/with-node.sh node -v"
fi
echo "  Using $NODE_VER"

# ── 2. Dependencies ──────────────────────────────────────────────────────────
if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  step "2/7" "npm install"
  if ! bash scripts/with-node.sh npm install; then
    fail "2/7 npm install" \
      "Dependency install failed.\nDebug:\n  - Delete node_modules and retry: rm -rf node_modules && npm install\n  - Check disk space and network\n  - Run manually: bash scripts/with-node.sh npm install"
  fi
else
  step "2/7" "npm install (skipped — --skip-install)"
fi

# ── 3. Env files ─────────────────────────────────────────────────────────────
step "3/7" "Environment files"
CREATED=0
if [[ ! -f apps/backend/.env ]]; then
  cp apps/backend/.env.example apps/backend/.env
  CREATED=1
  echo "  Created apps/backend/.env from .env.example"
fi
if [[ ! -f apps/frontend/.env ]]; then
  cp apps/frontend/.env.example apps/frontend/.env
  CREATED=1
  echo "  Created apps/frontend/.env from .env.example"
fi
if [[ "$CREATED" -eq 1 ]]; then
  echo ""
  echo "  ⚠ New .env files were created — fill in real keys before the app will work:"
  echo "    apps/backend/.env  → SUPABASE_*, R2_*, GOOGLE_SERVICE_ACCOUNT_*, GOOGLE_SHEET_FAST_RENTAL_ID"
  echo "    apps/frontend/.env → VITE_SUPABASE_*, VITE_API_BASE_URL=http://localhost:4000"
fi

# ── 4. verify-env ────────────────────────────────────────────────────────────
step "4/7" "verify-env"
if ! bash scripts/with-node.sh npm run verify-env; then
  fail "4/7 verify-env" \
    "Environment validation failed.\nDebug:\n  - Edit apps/backend/.env and apps/frontend/.env\n  - Required backend: SUPABASE_URL, SUPABASE_*_KEY, R2_*, GOOGLE_SHEET_FAST_RENTAL_ID\n  - Required frontend: VITE_API_BASE_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY\n  - Re-run: npm run verify-env"
fi

# ── 5. Database migrations ───────────────────────────────────────────────────
if [[ "$SKIP_DB" -eq 0 ]]; then
  step "5/7" "db:push (Supabase migrations)"
  if ! bash scripts/with-node.sh npm run db:push; then
    warn "5/7 db:push" \
      "Migration push failed.\nDebug:\n  - Run: npx supabase login && npm run db:push\n  - Or skip next time: npm run start:local -- --skip-db\n  - App may still work if DB is already up to date."
  fi
else
  step "5/7" "db:push (skipped — --skip-db)"
fi

# ── 6. Start servers ─────────────────────────────────────────────────────────
step "6/7" "Syncing logos from shared/logo"
if ! bash scripts/with-node.sh node scripts/sync-logos.mjs; then
  warn "6/7 sync-logos" \
    "Logo sync failed.\nDebug:\n  - Ensure shared/logo/logo-logigo.ico exists\n  - For login logo crop: python3 + Pillow (pip install Pillow)"
fi

step "7/7" "Starting dev servers"
echo "  Backend  → http://localhost:4000"
echo "  Frontend → http://localhost:5173"
echo "  (Union Rental is separate — :4001 API, :5174 web; not started by this script)"

bash scripts/with-node.sh env PORT=4000 npm run dev --workspace apps/backend > /tmp/fast-rental-backend.log 2>&1 &
BACKEND_PID=$!

bash scripts/with-node.sh npm run dev --workspace apps/frontend > /tmp/fast-rental-frontend.log 2>&1 &
FRONTEND_PID=$!

sleep 2
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  fail "7/7 backend dev server" \
    "Backend process exited immediately.\nDebug:\n  - Log: tail -50 /tmp/fast-rental-backend.log\n  - Common fixes: check apps/backend/.env, port 4000 in use (lsof -i :4000)\n  - Manual: npm run dev:backend"
fi
if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
  fail "7/7 frontend dev server" \
    "Frontend process exited immediately.\nDebug:\n  - Log: tail -50 /tmp/fast-rental-frontend.log\n  - Common fixes: port 5173 in use (lsof -i :5173)\n  - Union Rental uses :5174 — start it from the Union Rental repo, not here\n  - Manual: npm run dev:frontend"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Fast Rental is running locally"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Login:    http://localhost:5173/agent-login"
echo "  API:      http://localhost:4000"
echo ""
echo "  Logs:"
echo "    tail -f /tmp/fast-rental-backend.log"
echo "    tail -f /tmp/fast-rental-frontend.log"
echo ""
echo "  First-time admin (once):"
echo "    INITIAL_ADMIN_EMAIL=you@example.com \\"
echo "    INITIAL_ADMIN_PASSWORD='YourPassword' \\"
echo "    INITIAL_ADMIN_NAME='Your Name' \\"
echo "    npm run create-initial-admin"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo ""

wait "$BACKEND_PID" "$FRONTEND_PID"
