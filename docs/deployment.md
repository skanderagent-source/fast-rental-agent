# Deployment (Phases 21–23)

## Vercel (frontend) — Phase 21

1. Import GitHub repo into Vercel.
2. Root directory: repository root (uses root `vercel.json`).
3. Environment variables:
   - `VITE_API_BASE_URL`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_PUBLIC_SITE_URL` (Union Rental public URL)
4. Deploy. After deploy, update:
   - Supabase Auth redirect URLs
   - Backend `FRONTEND_ORIGIN`
   - R2 CORS allowed origins

## Hostinger VPS (backend) — Phase 22

1. `sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable`
2. Install Node via nvm (22), PM2, Caddy.
3. `sudo timedatectl set-timezone America/Toronto`
4. Clone repo to `/var/www/fast-rental`.
5. `npm install && npm run build --workspace @fast-rental/shared && npm run build --workspace @fast-rental/backend`
6. Create `apps/backend/.env` (`chmod 600`) with production values.
7. `pm2 start ecosystem.config.cjs && pm2 save && pm2 startup`
8. Copy [deploy/Caddyfile](../deploy/Caddyfile) to `/etc/caddy/Caddyfile`, reload Caddy.
9. Verify: `curl https://api.your-domain.com/health`

## DNS — Phase 23

See [dns.md](./dns.md).

## Security — Phase 24

See [security-checklist.md](./security-checklist.md).

## Cutover — Phase 25

When Fast Rental **and** Union Rental are live:

```bash
npm run cutover
npm run create-test-agent
```

Legacy reference app: `legacy/index.html` (root copy removed at cutover).

Apply [security-checklist.md](./security-checklist.md) sign-off after cutover.
