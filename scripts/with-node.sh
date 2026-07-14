#!/usr/bin/env bash
# Activates the Node version from .nvmrc (when nvm is installed), then runs the given command.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .nvmrc ]] && [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  nvm use --silent
fi

exec "$@"
