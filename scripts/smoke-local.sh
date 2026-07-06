#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Fast Rental local smoke (Phase 20) =="
node scripts/smoke-api.mjs

echo ""
echo "Optional live credential checks:"
echo "  npm run apply-ops          # offline + live when .env has real keys"
echo "See docs/smoke-test.md for the full manual UI checklist."
