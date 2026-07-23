# Deployment (Phases 21–23)

## Vercel (frontend) — Phase 21

1. Import GitHub repo into Vercel.
2. Root directory: repository root (uses root `vercel.json`).
3. Environment variables:
   - `VITE_API_BASE_URL`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_PUBLIC_SITE_URL` (Union Rental public URL)
4. Enable each variable for **Production** and **Preview**. On Vercel the app loads
   them at **request time** via `/api/runtime-config.js` (not baked into the static
   bundle). Local production builds still read `apps/frontend/.env` when present.
5. `vercel.json` includes a production `connect-src` CSP for the API and Supabase
   origins; update it if those URLs change.
6. Deploy. After deploy, update:
   - Supabase Auth redirect URLs
   - Backend `FRONTEND_ORIGIN`
   - R2 CORS allowed origins
6. Verify response headers include HSTS, CSP (`frame-ancestors 'none'`),
   `nosniff`, Referrer-Policy, and Permissions-Policy. In browser DevTools,
   confirm the generated CSP permits only the production API, Supabase,
   Cloudflare R2, and OpenStreetMap resources used by the app.

### Troubleshooting: Supabase login CORS / "No API key found"

Symptoms after redeploy:

- Browser: `Cross-Origin Request Blocked … CORS request did not succeed` (status `null`)
- Supabase response: `No API key found in request`

Cause: `/api/runtime-config.js` did not load or returned without `VITE_SUPABASE_ANON_KEY`, so the Supabase client never sends the `apikey` header.

Fix:

1. Vercel → Project → Settings → Environment Variables — confirm all four `VITE_*` vars exist, scoped to **Production** and **Preview**, with the anon key copied from Supabase → Project Settings → API (`anon` / publishable).
2. Open `https://YOUR_AGENT_DOMAIN/api/runtime-config.js` in the browser — it should return `window.__FAST_RENTAL_ENV__={...}` with all four keys. A 500 or console error lists what is missing.
3. If you use `npm run deploy:vercel`, export the four `VITE_*` vars in your shell **or** omit them so Vercel project settings are used. Do not pass empty `--build-env` values.
4. On the live site, View Source on `/` and confirm `<script src="/api/runtime-config.js">` appears before the app bundle.

## Hostinger VPS (backend) — Phase 22

1. `sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable`
2. Install Node via nvm (22), PM2, Caddy.
3. `sudo timedatectl set-timezone America/Toronto`
4. Clone repo to `/var/www/fast-rental`.
5. `npm install && npm run build --workspace @fast-rental/shared && npm run build --workspace @fast-rental/backend`
   Or use `bash scripts/deploy-vps.sh`, which also prunes dev dependencies and deletes backend source maps.
6. Create `apps/backend/.env` (`chmod 600`) with production values.
   Use a dedicated production Supabase project and production-only R2/Resend credentials.
   Set `FRONTEND_ORIGIN` to the exact Vercel URL(s). For staging plus production,
   use a comma-separated exact-origin list (no wildcards), e.g.
   `https://agent.example.com,https://agent-staging.example.com`.
   - `HOST=127.0.0.1`
   - `PUBLIC_API_BASE_URL=https://api.your-domain.com`
   - `TRUSTED_HOSTS=api.your-domain.com`
   - Keep the documented HTTP header/request/keep-alive timeout defaults unless
     production uploads demonstrate a need for a higher request timeout.
7. `pm2 start ecosystem.config.cjs && pm2 save && pm2 startup`
8. Replace every `api.YOUR_DOMAIN.com` placeholder in
   [deploy/Caddyfile](../deploy/Caddyfile), copy it to `/etc/caddy/Caddyfile`,
   validate with `caddy validate --config /etc/caddy/Caddyfile`, then reload.
9. Verify HTTPS and headers:
   - `curl -I http://api.your-domain.com/health` returns a permanent HTTPS redirect
   - `curl -I https://api.your-domain.com/health` includes HSTS, CSP,
     `nosniff`, Referrer-Policy, Permissions-Policy, and no `Server` or
     `X-Powered-By` header

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
