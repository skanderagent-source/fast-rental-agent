# Production security checklist (Phase 24)

Run before go-live and after any infrastructure change.

## Secrets

- [ ] No `.env` files committed (`npm run verify-env` passes git check)
- [ ] `SUPABASE_SERVICE_ROLE_KEY`, `R2_SECRET_ACCESS_KEY`, `RESEND_API_KEY` only in backend/VPS env
- [ ] Frontend env contains only `VITE_*` public keys

## Supabase

- [ ] Public sign-up disabled
- [ ] RLS enabled on all tables (migrations `0002` + `0006` at cutover)
- [ ] Service role used only server-side
- [ ] Redirect URLs whitelist production + localhost dev URLs only

## API

- [ ] CORS `FRONTEND_ORIGIN` lists exact production origins (no `*`)
- [ ] Rate limiter active on `/api/public`
- [ ] Helmet enabled (`apps/backend/src/app.ts`)
- [ ] Admin routes require `requireRole('admin')`
- [ ] Inactive agents receive 403

## R2

- [ ] Bucket is private (no public ACL)
- [ ] CORS allows PUT from frontend origin only
- [ ] Scoped API token (Object Read/Write on bucket only)

## Email

- [ ] HTML templates escape user input (`escapeHtml` in `templates.ts`)
- [ ] Prospect emails contain no internal fields (code entrée, concierge, admin links)
- [ ] Account-created email never includes password

## VPS

- [ ] `ufw` allows 22, 80, 443 only
- [ ] `apps/backend/.env` chmod 600
- [ ] PM2 autostart configured (`pm2 save`, systemd hook)
- [ ] Caddy TLS automatic

## Post-cutover

- [ ] `0006_lockdown_legacy_policies.sql` applied
- [ ] Legacy anon INSERT policies removed
- [ ] Legacy Edge Functions deleted

Sign-off: _______________  Date: _______________
