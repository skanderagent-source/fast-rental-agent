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
- [ ] Email OTP/link expiry is 900 seconds; resend/recovery cooldown is at least 60 seconds
- [ ] Supabase Auth rate limits reviewed after Custom SMTP configuration
- [ ] Require-current-password and secure password-change settings enabled
- [ ] JWT expiry is 1 hour, inactivity timeout 30 minutes, absolute lifetime 8 hours
- [ ] Refresh-token rotation enabled; global logout invalidates provider-side sessions

## API

- [ ] CORS `FRONTEND_ORIGIN` lists exact production origins (no `*`)
- [ ] CORS credentials disabled; allowed methods/headers match `app.ts`
- [ ] Rate limiter active on `/api/public` (30 req/min default)
- [ ] Rate limiter active on authenticated `/api/*` (300 req/min default)
- [ ] Helmet enabled (`apps/backend/src/app.ts`)
- [ ] `X-Powered-By` absent and production HTTP requests redirect to HTTPS
- [ ] CSP, HSTS, anti-clickjacking, nosniff, referrer, and permissions headers present
- [ ] OPTIONS preflights succeed only for registered API route/method/header combinations
- [ ] Unsupported methods return JSON 405; unknown routes return JSON 404
- [ ] TRACE, TRACK, and CONNECT rejected
- [ ] Production Host allowlist matches `PUBLIC_API_BASE_URL` / `TRUSTED_HOSTS`
- [ ] Express trusts loopback proxy only; backend binds to `127.0.0.1`
- [ ] JSON (2 MB), form/text (64 KB), and media (250 MB) body limits active
- [ ] Node max-header and header/request/keep-alive timeouts active
- [ ] Strict Zod schemas and UUID route parameter checks pass regression tests
- [ ] JSON DTO routes reject non-`application/json` bodies and top-level primitives
- [ ] Public listing/media responses pass outbound schemas and expose no storage/ownership fields
- [ ] Duplicate query keys and `__proto__`/`constructor`/`prototype` object keys rejected
- [ ] Express JSON escaping and contextual email HTML escaping enabled
- [ ] Listing writes use DTO and persistence field allowlists
- [ ] No raw runtime SQL, NoSQL datastore, dynamic evaluation, or unsafe deserializer introduced
- [ ] Admin routes use named `requirePermission(...)` scopes
- [ ] Destructive/sensitive workflows require a five-minute, single-use action token
- [ ] Migration `0027_security_action_tokens.sql` applied
- [ ] Inactive agents receive 403
- [ ] PostgREST search terms sanitized (`utils/postgrest.ts`)
- [ ] Listing search capped at `MAX_LISTING_SEARCH_ROWS` (2500)
- [ ] 5xx errors return generic message (`errorHandler.ts`)
- [ ] New account passwords: 10+ chars with letter and digit
- [ ] Password reset requires a recovery-authenticated JWT and revokes all sessions after completion
- [ ] Email/password changes require the current password
- [ ] Object-level authorization blocks IDOR on leads, media, comments, and rentals
- [ ] Authenticated API responses use `Cache-Control: no-store`
- [ ] Unpaginated list endpoints are hard-capped (users, rentals, my-calls)
- [ ] Listing query filters validate against bounded enums (statut, taille, source)
- [ ] API responses include `X-Request-Id` and emit structured `security_event` logs for auth/authz/rate-limit anomalies
- [ ] Request logs redact Authorization, cookies, action tokens, and password/token JSON fields
- [ ] 5xx responses remain generic; no stack traces or dependency internals in client JSON
- [ ] Production uses separate Supabase/R2/Resend credentials from development
- [ ] Database backups stored encrypted off-repo with restricted operator access
- [ ] `/health` exposes only `{ ok: true }` with `Cache-Control: no-store`
- [ ] Supabase queries time out via `DB_QUERY_TIMEOUT_MS`
- [ ] PM2/API graceful shutdown stops cron jobs and closes HTTP server
- [ ] `npm run audit:deps` passes in CI (`npm audit --audit-level=high`)
- [ ] `package-lock.json` committed; production deploy prunes dev dependencies
- [ ] Production builds omit source maps; `*.map` requests return 404 on Vercel
- [ ] Caddy TLS protocols limited to TLS 1.2 and TLS 1.3
- [ ] `npm run scan-secrets` passes in CI
- [ ] `security-regression.test.ts` passes (auth, authz, CORS, cache, rate-limit registration)
- [ ] `FRONTEND_ORIGIN` lists exact per-environment frontend URLs (comma-separated if needed)
- [ ] VPS time sync verified (`timedatectl` / NTP active)
- [ ] Transactional email uses Resend with validated recipients and sanitized subjects
- [ ] Password reset UI uses enumeration-safe messaging
- [ ] Supabase leaked-password protection enabled in production Auth settings
- [ ] Listing search `q` requires at least two characters when provided

## R2

- [ ] Bucket is private (no public ACL)
- [ ] CORS allows PUT from frontend origin only
- [ ] Scoped API token (Object Read/Write on bucket only)
- [ ] Stale media cleanup deletes orphaned R2 objects

## Email

- [ ] HTML templates escape user input (`escapeHtml` in `templates.ts`)
- [ ] Dynamic email subjects contain no CR/LF/control characters
- [ ] Prospect emails contain no internal fields (code entrée, concierge, admin links)
- [ ] Account-created email never includes password

## VPS

- [ ] `ufw` allows 22, 80, 443 only
- [ ] `apps/backend/.env` chmod 600
- [ ] PM2 autostart configured (`pm2 save`, systemd hook)
- [ ] Caddy TLS automatic
- [ ] Replace `api.YOUR_DOMAIN.com` in `deploy/Caddyfile` before reload
- [ ] `curl -I http://api.<domain>/health` returns a permanent HTTPS redirect
- [ ] Caddy strips its `Server` response header
- [ ] Caddy config validation accepts timeout/max-header directives
- [ ] Port 4000 is not publicly reachable; Node `HOST=127.0.0.1`

## Vercel

- [ ] Security headers configured (`vercel.json`)
- [ ] Production HTML contains generated CSP with exact API and Supabase origins
- [ ] CSP reports no blocked API, Supabase Auth, R2, or OpenStreetMap requests
- [ ] Only `VITE_*` public env vars in project settings

## Post-cutover

- [ ] `0006_lockdown_legacy_policies.sql` applied
- [ ] Legacy anon INSERT policies removed
- [ ] Legacy Edge Functions deleted

Sign-off: _______________  Date: _______________
