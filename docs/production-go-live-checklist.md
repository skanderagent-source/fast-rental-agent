# Fast Rental production go-live checklist

Complete after code deploy and before handing the app to the customer.

## 1. Pre-deploy (local / CI)

- [ ] `npm run verify-env` passes (no secrets in git, no frontend service role)
- [ ] `npm run security-checklist` passes
- [ ] `npm run build` passes
- [ ] `npm run test` passes
- [ ] `npm run smoke` passes
- [ ] All Supabase migrations applied (`npm run verify-migrations` with credentials)

## 2. Supabase dashboard

- [ ] Public sign-up **disabled**
- [ ] Email redirect URLs whitelist: production agent URL + localhost dev only
- [ ] RLS enabled on all tables; migration `0006_lockdown_legacy_policies.sql` applied at cutover
- [ ] Service role key stored **only** on VPS backend `.env`
- [ ] Strong passwords enforced for all admin accounts
- [ ] Initial admin created via `npm run create-initial-admin` (then remove bootstrap env vars)

## 3. Cloudflare R2

- [ ] Bucket is **private** (no public ACL)
- [ ] Scoped API token (Object Read/Write on this bucket only)
- [ ] CORS applied: `npm run configure-r2-cors` with production agent origin
- [ ] `STORAGE_DRIVER=r2` in production backend `.env`

## 4. Hostinger VPS (API)

- [ ] Node 22 installed; repo at `/var/www/fast-rental`
- [ ] `apps/backend/.env` created with production values, `chmod 600`
- [ ] `FRONTEND_ORIGIN` set to exact Vercel URL(s) — no wildcard
- [ ] `HOST=127.0.0.1`, production `PUBLIC_API_BASE_URL`, and exact `TRUSTED_HOSTS` set
- [ ] Caddy configured from `deploy/Caddyfile`; TLS active on `api.YOUR_DOMAIN.com`
- [ ] `caddy validate --config /etc/caddy/Caddyfile` accepts timeout/header limits
- [ ] `ufw` allows 22, 80, 443 only
- [ ] VPS port 4000 is not externally reachable
- [ ] PM2 running: `pm2 start ecosystem.config.cjs`; `pm2 save`
- [ ] Node 22 LTS runtime installed (`.nvmrc` / `engines.node >= 22`)
- [ ] `GET https://api.YOUR_DOMAIN.com/health` returns `{ "ok": true }` only
- [ ] Rate limits active: public 30/min, authenticated 300/min
- [ ] TRACE/TRACK/CONNECT blocked and unsupported API methods return 405

## 5. Vercel (frontend)

- [ ] `VITE_API_BASE_URL` → production API URL
- [ ] `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set
- [ ] `VITE_PUBLIC_SITE_URL` → Union Rental public site
- [ ] Security headers from `vercel.json` deployed
- [ ] SPA loads at `agent.YOUR_DOMAIN.com`

## 6. DNS

- [ ] `agent.*` CNAME → Vercel
- [ ] `api.*` A record → VPS IP
- [ ] `npm run verify-dns` passes

## 7. Functional smoke (production)

- [ ] Agent login works; inactive account gets 403
- [ ] Admin can create agent with strong password (10+ chars, letter + digit)
- [ ] Agent can search listings, view detail, upload media
- [ ] Public `/api/public/listings` returns redacted fields only
- [ ] Referral link uses admin-managed `referral_slug`
- [ ] Lead assignment works (admin assigns, agent updates progress)
- [ ] Email notifications work if `EMAIL_ENABLED=true` (`npm run verify-email`)

## 8. Operations

- [ ] Database backup scheduled or manual run documented (`npm run backup-db`)
- [ ] Backup files chmod `600`, stored outside git, encrypted at rest (gpg or provider vault)
- [ ] Production Supabase project/credentials differ from local development
- [ ] PM2 logs accessible: `pm2 logs fast-rental-api`
- [ ] Uptime monitor on `/health` (recommended: UptimeRobot, Better Stack, etc.)
- [ ] Error tracking configured (recommended: Sentry) — alert on repeated `security_event` auth/authz/rate-limit spikes
- [ ] Incident contact and secret rotation procedure documented
- [ ] Lower environments do not receive raw production database dumps without anonymization

## 9. Post-cutover (when Union Rental is live)

- [ ] Migration `0006` applied
- [ ] Legacy anon INSERT policies removed
- [ ] Legacy Edge Functions deleted

## Sign-off

| Role | Name | Date |
|------|------|------|
| Developer | | |
| Customer / Admin | | |

See also [security-threat-model.md](./security-threat-model.md) and [security-checklist.md](./security-checklist.md).
