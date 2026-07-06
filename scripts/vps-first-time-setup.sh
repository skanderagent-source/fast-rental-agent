#!/usr/bin/env bash
# Phase 22: First-time VPS setup (Ubuntu/Debian)
set -euo pipefail

echo "Installing base packages…"
sudo apt-get update
sudo apt-get install -y curl git ufw

echo "Configuring firewall…"
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

echo "Installing nvm + Node 22…"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 22
nvm use 22
npm install -g pm2

echo "Installing Caddy…"
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy

sudo timedatectl set-timezone America/Toronto 2>/dev/null || true

echo "✓ VPS base setup complete. Clone repo to /var/www/fast-rental and run scripts/deploy-vps.sh"
