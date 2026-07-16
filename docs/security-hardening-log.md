# Security hardening implementation log

Tracks controls applied during production hardening. User-supplied 10-item chunks will be appended here as they are evaluated.

## Foundation hardening (pre-chunk baseline)

Applied from repository audit before customer chunk review.

| # | Control | Status | Layer | Notes |
|---|---------|--------|-------|-------|
| 1 | PostgREST search sanitization | Implemented | Backend | `sanitizePostgrestSearchTerm` strips filter metacharacters |
| 2 | Listing search row cap | Implemented | Backend | `MAX_LISTING_SEARCH_ROWS=2500` prevents memory DoS |
| 3 | Authenticated API rate limiting | Implemented | Backend | 300 req/min default on `/api/*` (public has separate 30/min) |
| 4 | Generic 5xx error messages | Implemented | Backend | DB/internal errors no longer leak to clients |
| 5 | Strong password policy | Implemented | Shared + frontend | 10+ chars, letter + digit for admin-created accounts |
| 6 | Profile photo ownership validation | Implemented | Backend | `profilePhotoMediaId` must belong to requesting user |
| 7 | Stale media R2 cleanup | Implemented | Backend | Cron job deletes orphaned objects before DB row |
| 8 | Admin test-email validation | Implemented | Backend | Zod email schema on `/api/admin/email/test` |
| 9 | Referral slug fix | Implemented | Frontend | Uses `referral_slug` instead of derived `nom` |
| 10 | Vercel security headers | Implemented | Vercel | X-Content-Type-Options, X-Frame-Options, Referrer-Policy |
| 11 | Reduced max listing page size | Implemented | Shared | `pageSize` max 100 (was 5000) |
| 12 | Gitignore Supabase CLI temp | Implemented | Repo | `supabase/.temp/` excluded from version control |
| 13 | Threat model documentation | Implemented | Docs | `docs/security-threat-model.md` |
| 14 | Production go-live checklist | Implemented | Docs | `docs/production-go-live-checklist.md` |

## Deferred (product / infrastructure decisions)

| Item | Reason |
|------|--------|
| Field-level redaction for agents | Agents are trusted workforce; need entry codes for showings |
| Media pending approval workflow | Intentional auto-approve for agent velocity (migration 0010) |
| APM / Sentry | Infrastructure choice; documented in go-live checklist |

## Chunk 1 — HTTP delivery and browser boundary (2026-07-16)

| # | Proposal | Decision | Implementation |
|---|----------|----------|----------------|
| 1 | Framework security headers | Adapt | Existing Helmet is now explicitly configured in `app.ts`; Caddy and Vercel add edge policies |
| 2 | Forced HTTPS | Implement | Caddy has an explicit permanent redirect; `enforceHttps` adds a production 308 fallback; Vercel terminates HTTPS |
| 3 | Disable technology disclosure | Implement | Express `x-powered-by` disabled; Helmet hide-powered-by retained; Caddy strips `Server` |
| 4 | HSTS | Implement | One-year HSTS with subdomains/preload on Helmet, Caddy, and Vercel |
| 5 | Anti-clickjacking | Implement | CSP `frame-ancestors 'none'` at API and frontend edges; `X-Frame-Options: DENY` fallback |
| 6 | Content sniffing prevention | Implement | `nosniff` supplied by Helmet, Caddy, and Vercel |
| 7 | Referrer policy | Implement | `strict-origin-when-cross-origin` consistently applied |
| 8 | Permissions Policy | Implement | Camera, microphone, geolocation, payment, and USB denied because the portal does not use them |
| 9 | Frontend CSP | Implement | Production build injects exact API/Supabase origins; scripts are self-only with no `unsafe-inline`/`unsafe-eval`; inline styles remain allowed because React components currently use style props |
| 10 | Exact CORS | Implement | Exact validated origins, explicit methods/headers, no credentialed CORS; R2 upload headers narrowed to `Content-Type` |

Tests: `apps/backend/tests/security-headers.test.ts` verifies headers, HTTPS redirect, exact-origin preflight, and denial of unlisted origins.

## Chunk 2 — HTTP request boundary and input handling (2026-07-16)

| # | Proposal | Decision | Implementation |
|---|----------|----------|----------------|
| 11 | Restricted preflight handling | Implement | Explicit API route/method registry validates preflight route, requested method, and requested headers before CORS |
| 12 | Restrict methods per route | Implement | Known routes return consistent JSON `405` plus `Allow`; unknown routes return JSON `404` |
| 13 | Block TRACE/TRACK and raw verbs | Implement | Express rejects TRACE/TRACK/CONNECT, Caddy blocks them, and Node closes CONNECT/upgrade requests |
| 14 | Host allowlist | Implement | Production accepts the `PUBLIC_API_BASE_URL` host and exact optional `TRUSTED_HOSTS`; Caddy site label is the first host gate |
| 15 | Trusted proxy configuration | Adapt | Express trusts loopback only and Node binds to `127.0.0.1`, matching the local Caddy topology |
| 16 | Request normalization | Implement | Duplicate singleton headers, CL+TE ambiguity, absolute-form/noncanonical paths, encoded separators, and forwarded-header ambiguity are rejected or normalized |
| 17 | Body size limits | Implement | JSON 2 MB; URL-encoded and text 64 KB; media raw body capped at 250 MB; Caddy absolute request cap 260 MB |
| 18 | Header and request timeouts | Implement | Node max header 16 KB, header timeout 15s, request timeout 120s, keep-alive 5s; Caddy mirrors edge limits |
| 19 | Slowloris/connection exhaustion | Implement | Caddy read/write/idle limits plus Node header/request/keep-alive timeouts and max 100 headers |
| 20 | Input validation on API endpoints | Adapt | All consumed JSON/query inputs use strict bounded Zod schemas; all route IDs validate as UUIDs; storage query is strict and bounded |

Tests: `apps/backend/tests/request-boundary.test.ts` covers raw verbs, 404/405 behavior, noncanonical paths, host validation, preflights, UUID/query validation, and parser limits.

## Chunk 3 — Schemas, injection, and safe object handling (2026-07-16)

| # | Proposal | Decision | Implementation |
|---|----------|----------|----------------|
| 21 | API schema validation | Implement | All consumed API body/query values use strict bounded Zod schemas; route IDs use UUID validation |
| 22 | Response schema enforcement | Adapt | Public listing list/detail responses now pass through outbound Zod schemas that project only approved public fields |
| 23 | Output sanitization | Implement | Express JSON escaping enabled; HTML email templates retain contextual escaping; comment HTML stripping remains server-side |
| 24 | Parameter pollution protection | Implement | Explicit simple query parser plus raw duplicate-key rejection before schema parsing |
| 25 | Mass-assignment prevention | Implement | Strict DTOs reject unknown fields and listing persistence independently allowlists writable columns |
| 26 | SQL injection prevention | Verify existing | Supabase query builder/RPC parameters are used; no runtime raw SQL; the one PostgREST filter DSL input is bounded and sanitized |
| 27 | NoSQL injection prevention | Not applicable | No MongoDB, Redis, document database, or NoSQL query runtime exists in this application |
| 28 | ReDoS mitigation | Adapt | Regexes are linear/simple and all user-controlled regex inputs are bounded by schemas, body limits, or header limits |
| 29 | Prototype pollution protection | Implement | Recursive dangerous-key rejection, simple query parsing, strict DTOs, and null-prototype writable maps |
| 30 | Secure deserialization | Verify existing | No eval, Function, vm, YAML tags, or untrusted object revivers; automated checklist scans source for regressions |

Tests cover public media-field projection, mass-assignment rejection, duplicate query parameters, prototype keys, and JSON escaping.

## Chunk 4 — Account authentication and authorization (2026-07-16)

| # | Proposal | Decision | Implementation |
|---|----------|----------|----------------|
| 40 | Email verification token security | Supabase-managed | Supabase signed, expiring, single-use email actions retained; production runbook sets the shared email-link expiry to 15 minutes |
| 41 | Password reset token security | Adapt | Supabase consumes the recovery token once; the reset page requires the JWT `recovery` authentication method, applies the strong password policy, and globally revokes sessions after completion |
| 42 | Vetted password hashing | Verify provider | Supabase Auth hashes passwords with bcrypt and random salts; the application never stores passwords or hashes |
| 43 | Login brute-force throttling | Supabase-managed | Direct browser login remains with Supabase Auth so passwords are not proxied through the API; production rate-limit verification added to the Auth runbook |
| 44 | High-abuse route limits | Adapt | Supabase limits recovery/OTP/verification/resend endpoints; Express public/authenticated API limits remain active. Checkout/payment/customer reservation routes do not exist |
| 45 | Lockout or failure step-up | Defer hard lockout | Automatic lockout was rejected because attackers could deny access to known agents. Supabase rate limits, admin MFA, monitoring, and administrative deactivation are used instead |
| 46 | Admin MFA/TOTP | Implement | TOTP enrollment/challenge UI added; admin permission middleware requires a Supabase `aal2` JWT |
| 47 | MFA backup codes | Provider limitation / adapt | Supabase does not support recovery codes. The UI recommends a separately stored second TOTP factor and prevents an admin from removing their only factor through the portal |
| 48 | Step-up for security-critical changes | Implement | Email/password changes submit the current password; password changes revoke other sessions; factor removal requires AAL2; recovery updates require a recovery-authenticated session |
| 49 | RBAC on protected operations | Strengthen | Role matching is now exact; all admin routes use centralized authorization middleware, while service ownership/assignment checks remain in place |
| 50 | Fine-grained API permissions | Implement | Named scopes cover users, listings, media moderation, lead assignment/deletion, Sheets, geocoding, email tests, and admin reporting |

Tests: `apps/backend/tests/auth.test.ts` verifies that AAL1 admin sessions receive `MFA_REQUIRED` and AAL2 sessions can exercise scoped admin operations.

## Chunk 5 — Rendering, sessions, and sensitive actions (2026-07-16)

| # | Proposal | Decision | Implementation |
|---|----------|----------|----------------|
| 31 | Template injection prevention | Adapt / verify | The app has no server-rendered views or PDF generator. React escapes rendered values; email HTML uses contextual escaping, and dynamic email subjects now strip CR/LF/control characters |
| 32 | Safe JSON parsing and serialization | Strengthen | Express accepts strict object/array JSON only as `application/json`; schema-backed body routes return 415 for other content types; JSON escaping, strict Zod DTOs, and public output schemas remain active. Media persistence uses the server-recorded allowlisted MIME rather than trusting the upload request header |
| 33 | Session rotation | Implement / provider | Supabase creates a new session at login and MFA verification upgrades it to a fresh AAL2 token. Email/password/MFA changes refresh the current session; role is read from the database on every API request rather than trusted from stale JWT metadata |
| 34 | Server-side logout/session invalidation | Verify provider | Global logout and refresh-token invalidation are handled by Supabase's production session store. Node keeps no in-memory login session |
| 35 | Inactivity and absolute lifetime | Production setting | Auth runbook specifies 30-minute inactivity, 8-hour absolute lifetime, and 1-hour JWT expiry; live Supabase dashboard verification remains required |
| 36 | Secure auth cookies | Not applicable | The SPA uses a Bearer access token in the Authorization header, not authentication cookies |
| 37 | Cookie signing/session secrets | Not applicable | No application session cookie or cookie-signing secret exists; Supabase signing keys/service credentials remain managed configuration |
| 38 | CSRF protection | Not applicable to current auth | Browser API calls require an explicit Bearer header, CORS is exact-origin/non-credentialed, and no ambient auth cookie is sent. A cookie migration would require CSRF controls before release |
| 39 | One-time sensitive action tokens | Implement | A 256-bit random token is returned once, stored only as SHA-256, bound to user/action/target, expires after five minutes, and is atomically deleted on use from a service-role-only RLS table (`0027_security_action_tokens.sql`) |

Tests cover strict JSON content types/primitives, dynamic email escaping/header controls, one-time token hashing/binding/consumption, and rejection of destructive calls without confirmation.

## Chunk 6 — Object access, data boundaries, and workflow controls (2026-07-16)

| # | Proposal | Decision | Implementation |
|---|----------|----------|----------------|
| 51 | Object-level authorization / IDOR prevention | Verify + strengthen | Leads, media, comments, rentals, and profile-photo updates enforce ownership or assignment in services; rentals creation now validates listing existence, lead assignment, and active agent targets |
| 52 | Row/resource/ownership checks in queries | Verify existing | Service-layer filters (`assigne_a`, `uploaded_by`, `agent_id`) plus Supabase RLS as defense-in-depth; backend uses service role so Express checks are primary |
| 53 | Pagination maximum limits and bounded sorting/filtering | Strengthen | `pageSize` capped at 100; listing search row cap 2500; unpaginated lists capped (`MAX_USERS_LIST`, `MAX_AGENT_CALLS`, `MAX_RENTALS_LIST`); listing filters now enum-validated; sort remains server-fixed |
| 54 | Data minimization on API responses | Adapt | Public endpoints use `pickPublic()` plus outbound Zod schemas; authenticated agents intentionally receive full listing/lead fields per trusted-workforce threat model |
| 55 | Data export authorization and audit logging | Not applicable | No bulk export or CSV/JSON dump endpoints exist; per-file presigned downloads and admin activity logging remain |
| 56 | Soft delete authorization and restore controls | Adapt | Listings soft-delete (admin + action token); users deactivate/reactivate (admin + action token); no listing restore by design; lead archive is one-way |
| 57 | Secure account deletion workflows | Verify existing | Admin-only hard delete with action token, self-delete blocked, Supabase auth user removed, activity logged; rentals FK restrict prevents unsafe orphan deletes |
| 58 | Secure redirects | Verify existing | Password reset uses `${window.location.origin}/auth/reset-password`; referral URLs built from configured `VITE_PUBLIC_SITE_URL`; no open `returnTo` parameter |
| 59 | Idempotency keys for mutating workflows | Adapt | No payments/reservations/checkout; destructive workflows use one-time action tokens (replay-safe confirmation); general `Idempotency-Key` headers not added |
| 60 | Prevent caching of authenticated/private API responses | Implement | `preventPrivateResponseCaching` sets `Cache-Control: no-store, no-cache, must-revalidate, private` on all `/api/*` except `/api/public/*` |

Tests: `leads.test.ts` (lead progress IDOR), `rentals.test.ts` (rental ownership), `security-headers.test.ts` (private cache policy).

## Chunk 7 — Logging, errors, secrets, and operations (2026-07-16)

| # | Proposal | Decision | Implementation |
|---|----------|----------|----------------|
| 61 | Secure cache-control headers for sensitive endpoints | Verify existing | Chunk 6 `preventPrivateResponseCaching` already applies `Cache-Control: no-store` to all authenticated `/api/*` routes; `/api/public/*` excluded for intentional CDN caching |
| 62 | Structured security logging with request identifiers | Implement | `attachRequestId` sets/propagates `X-Request-Id`; `logSecurityEvent` emits consistent `security_event` records with method, path, IP, user agent, userId, reason, and status |
| 63 | PII/token/credential redaction in logs | Strengthen | Pino redacts Authorization, cookies, action tokens, and password/token body fields; email logs redact recipient addresses in production (`toDomain` only) |
| 64 | Centralized error handling without leaking internals | Verify + strengthen | `errorHandler` returns generic 5xx messages; production hides non-`HttpError` client messages; server logs retain details with `requestId` |
| 65 | No stack traces or dev error pages in production | Verify existing | API responses never include `stack`; Express `x-powered-by` disabled; production `NODE_ENV` required on VPS |
| 66 | Suspicious activity alerts | Adapt / operational | Structured `security_event` logs now cover auth failures, authorization denials, MFA step-up blocks, action-token failures, and rate-limit hits; alert routing (Sentry/uptime) remains go-live configuration |
| 67 | Secret management via platform secret stores | Operational | Secrets load from VPS `.env` (`chmod 600`) and Vercel/Supabase/Cloudflare dashboards; `verify-env` blocks tracked `.env` files and frontend service-role leakage |
| 68 | Separate credentials per environment | Operational | Distinct Supabase/R2/Resend/Google credentials per environment documented; production env schema enforces HTTPS origins and public API URL |
| 69 | Production data masking for lower environments | Policy / not applicable | No automated prod→staging replication exists; operators must not copy production DB dumps into dev without anonymization |
| 70 | Backup encryption and restricted backup access | Operational + script hardening | `npm run backup-db` writes to gitignored `backups/`, chmod `600`, and documents encrypted off-repo storage; Supabase managed backups recommended for production |

Tests: `security-logging.test.ts`, `errorHandler.test.ts`.

## Chunk 8 — Runtime resilience, admin surface, and dependency hygiene (2026-07-16)

| # | Proposal | Decision | Implementation |
|---|----------|----------|----------------|
| 71 | Database least-privilege credentials | Adapt / architectural | Backend requires Supabase service role to bypass RLS for trusted API authorization; RLS remains defense-in-depth. R2 uses scoped bucket tokens; frontend receives anon key only |
| 72 | Database query timeout limits | Implement | Supabase client fetch wrapper applies `DB_QUERY_TIMEOUT_MS` (default 30s) via `AbortSignal.timeout` |
| 73 | Connection pool exhaustion protection | Adapt | Supabase access is stateless HTTP/PostgREST (no app-side DB pool); Node HTTP timeouts, rate limits, and body limits provide backpressure |
| 74 | Graceful shutdown | Implement | `registerGracefulShutdown` handles SIGTERM/SIGINT, stops cron jobs, closes HTTP server, and force-exits after `SHUTDOWN_GRACE_MS`; PM2 `kill_timeout` aligned |
| 75 | Healthcheck with limited exposure | Verify + strengthen | `/health` returns only `{ ok: true }` with `Cache-Control: no-store`; no dependency/version details |
| 76 | Admin endpoints behind extra auth | Verify existing | `/api/admin/*` requires auth, named permissions, and AAL2 MFA; sensitive flows also require action tokens |
| 77 | Cron/maintenance/diagnostics protected | Verify existing | Cron runs in-process only; maintenance triggers (`/admin/sheets/*`, `/admin/geocode/run`, etc.) are authenticated admin routes behind VPS loopback + Caddy |
| 78 | Background job endpoints authenticated | Verify existing | No public job-trigger HTTP surface; only authenticated admin routes can start sheet import/sync/geocode |
| 79 | Server-side feature flags | Verify existing | `EMAIL_ENABLED`, `RUN_SHEET_SYNC_ON_STARTUP`, `STORAGE_DRIVER`, and rate-limit env vars are evaluated server-side only |
| 80 | Outbound secret redaction in logs/telemetry | Strengthen | Base Pino logger redacts common secret field names and auth headers in serialized errors; no Sentry/APM SDK in repo yet |
| 81 | Dependency vulnerability scanning | Implement | `npm run audit:deps` (`npm audit --audit-level=high`) added; CI runs audit, tests, build, and security checklist |
| 82 | Lockfile integrity enforced | Verify existing | `package-lock.json` committed; CI uses `npm ci` |
| 83 | Dependency allowlists / provenance | Defer / operational | Standard npm registry usage; no private registry lockdown required for this deployment model |
| 84 | Remove unused packages from production artifacts | Implement | Unused `morgan` dependency removed; `deploy-vps.sh` runs `npm prune --omit=dev` after build |
| 85 | Supported Node.js runtime | Verify existing | `.nvmrc` and `engines.node >= 22`; CI and docs target Node 22 LTS |

Tests: `auth.test.ts` (health exposure), `jobs.test.ts` (stopJobs).

## Chunk 9 — Platform edge, artifacts, CI, and production posture (2026-07-16)

| # | Proposal | Decision | Implementation |
|---|----------|----------|----------------|
| 86 | Container hardening | Not applicable | Deployment uses PM2 on VPS and Vercel serverless/static hosting; no application Dockerfile. VPS hardening (ufw, loopback bind, chmod 600) documented |
| 87 | Production environment separation | Operational + verify | Distinct Supabase/R2/Vercel/VPS projects per environment; production `env.ts` enforces HTTPS API URL and exact frontend origins |
| 88 | TLS 1.2 minimum / TLS 1.3 preferred | Implement | Caddy site block now sets `tls { protocols tls1.2 tls1.3 }`; Vercel edge terminates modern TLS by default |
| 89 | Restrict static file serving | Verify existing | No `express.static`; local dev storage serves only validated `listings/*` keys from DB; production media uses private R2 presigned URLs |
| 90 | Disable directory listing | Verify existing | No directory indexes in API or Vercel static output; SPA rewrites serve `index.html` only |
| 91 | Restrict production source maps / build artifacts | Implement | Backend production build uses `tsconfig.build.json` without source maps; Vite disables production sourcemaps; Vercel returns 404 for `*.map`; deploy script deletes backend `dist/*.map` |
| 92 | CI/CD secret scanning | Implement | `npm run scan-secrets` scans tracked files for PEM keys and live secret assignments; CI runs it on every push/PR |
| 93 | Time synchronization (NTP) | Operational | VPS go-live uses `timedatectl`; token expiry accuracy depends on provider-managed Supabase/Vercel clocks |
| 94 | Legal retention and deletion controls | Adapt / policy | Admin can deactivate/delete users with action tokens and activity logging; leads retained per business policy (`0014_retain_leads_indefinitely`); no self-service GDPR erasure automation |
| 95 | Resource monitoring and restart policy | Strengthen | PM2 `autorestart`, `max_restarts`, `min_uptime`, exponential backoff, and `max_memory_restart` configured |
| 96 | Crash dump / diagnostic sanitization | Adapt | Production logs use Pino redaction; PM2 does not persist secrets; operators should avoid `--inspect` and raw core dumps on production hosts |
| 97 | Security regression tests | Implement | `security-regression.test.ts` covers auth bypass, authz boundaries, CSRF posture, CORS, cache policy, and rate-limit registration |
| 98 | Production build disables debug/dev modes | Verify + strengthen | `NODE_ENV=production` in PM2; production logger level `info`; rate limiters disabled only in `NODE_ENV=test`; no test routes in production router |
| 99 | Allowed origins per environment | Operational | `FRONTEND_ORIGIN` accepts comma-separated exact origins for staging + production; documented in deployment runbook |
| 100 | SameSite cookie behavior | Not applicable | SPA authenticates with explicit Bearer headers, not cookies; documented in `supabase-auth-setup.md` with migration requirements if cookies are introduced |

Tests: `security-regression.test.ts`.

## Chunk 10 — Email abuse, account flows, and query economics (2026-07-16)

| # | Proposal | Decision | Implementation |
|---|----------|----------|----------------|
| 101 | Email/header injection prevention | Strengthen | Resend API (no raw SMTP); `safeEmailHeader` on subjects; `escapeHtml` in templates; recipient/reply-to email validation; CRLF rejection in `to`; production `EMAIL_FROM`/`EMAIL_REPLY_TO` validation |
| 102 | Account enumeration protection | Strengthen | Login uses generic failure copy; password reset UI always shows the same success message; auth security logs omit credential hints |
| 103 | Password policy and breached-password checks | Verify + operational | Shared/backend `passwordSchema` and frontend `validatePasswordPair`; Supabase Auth leaked-password protection documented for production dashboard enablement |
| 104 | Session/authorization refresh after account changes | Verify existing | API reads `agents` profile (role, `actif`) on every request; password changes revoke other sessions client-side; email/MFA changes refresh Supabase session; deactivated accounts blocked immediately |
| 105 | Transaction/concurrency for inventory/payments | Adapt / N/A | No checkout/payments/reservations; lead assignment and media upload quotas use Postgres RPCs (`assign_demande_client`, `reserve_listing_media_upload`) for atomic consistency |
| 106 | Search/filter abuse controls | Strengthen | Listing `q` now requires min 2 chars; enum-bounded filters; pagination caps; PostgREST sanitization; row caps; DB query timeout; API rate limits; admin agent stats capped at 500 |
| 107 | Public contact-form spam handling | Not applicable | No public contact/lead POST API in Fast Rental; prospect intake lives on external Union Rental; public API is read-only listings |

Tests: `email.test.ts`, `security-hardening.test.ts`.

## Chunk 11 — Sessions, JWT validation, and rate-limit signaling (2026-07-16)

| # | Proposal | Decision | Implementation |
|---|----------|----------|----------------|
| 108 | Concurrent session limits per account | Supabase-managed / defer | Supabase Auth session lifetime controls (1h JWT, 30m inactivity, 8h absolute) documented in `supabase-auth-setup.md`. No custom concurrent-session cap added because agents may use phone + desktop during showings |
| 109 | Device/session management dashboard and remote logout | Provider-managed / defer | Supabase stores refresh tokens and supports global sign-out; frontend already revokes all sessions after recovery and other sessions after password change. No in-app device registry added for this internal workforce size |
| 110 | JWT validation (issuer, audience, expiry, signature, type) | Verify provider | `supabaseAdmin.auth.getUser(token)` validates signature, expiry, issuer, and audience against Supabase Auth before any route handler runs |
| 111 | JWT signing algorithm allowlists | Implement | `hasDisallowedJwtHeader` rejects `alg=none` and non-Supabase algorithms before provider lookup; allows HS256/RS256/ES256/ES384/ES512 used by Supabase Auth signing keys |
| 112 | Short-lived access tokens | Verify provider | Production runbook sets Supabase JWT expiry to 1 hour; API re-reads `agents` profile on every request |
| 113 | Refresh token rotation, reuse detection, storage, revocation | Verify provider | Supabase refresh-token rotation enabled in dashboard runbook; reuse interval kept at provider default or lower; Node stores no refresh tokens |
| 114 | Replay attack protection for critical endpoints | Verify existing | Destructive workflows require one-time action tokens (SHA-256, user/action/target-bound, 5-minute TTL, atomic consume). General mutating routes rely on Bearer auth + ownership checks |
| 115 | Nonce and timestamp validation for signed requests | Not applicable | API uses Bearer JWTs, not HMAC-signed request envelopes |
| 116 | API key hashing and fixed-time comparison | Not applicable | Client authentication is Supabase JWT Bearer tokens, not application-issued API keys. Service credentials remain env-only |
| 117 | Secrets rotation automation | Operational | VPS `.env`, Vercel, Supabase, and Cloudflare dashboards support manual rotation; no runtime secret reload added because PM2 restart is acceptable for this deployment |
| 118 | KMS/HSM-backed encryption keys | Operational / defer | Hostinger VPS deployment uses platform secret stores; dedicated KMS/HSM is a compliance/infrastructure upgrade path |
| 119 | Honeypot fields or endpoints for bot detection | Not applicable | Internal authenticated portal with no public write/contact endpoints; public API is read-only listings |
| 120 | Abuse fingerprinting beyond IP | Defer | Express + Supabase rate limits, structured `security_event` logs, and Supabase Auth throttling cover current abuse model; device/behavior fingerprinting deferred unless attack volume warrants it |
| 121 | Retry-After headers on 429 responses | Implement | Rate-limit handler now sets `Retry-After` (seconds) from express-rate-limit reset time; CORS exposes the header alongside standard `RateLimit-*` headers |

Tests: `jwt-and-rate-limit.test.ts`, `auth.test.ts` (disallowed JWT alg), `security-regression.test.ts`.

## Chunk 12 — Upload safety, storage boundaries, and realtime protocols (2026-07-16)

| # | Proposal | Decision | Implementation |
|---|----------|----------|----------------|
| 122 | Impossible travel detection | Defer / N/A | Single-region internal workforce; Supabase Auth has no built-in geo step-up and agents travel locally for showings |
| 123 | Attribute/policy-based authorization beyond RBAC | Verify existing | Named admin permissions plus object ownership/assignment checks in services cover lead/media/comment/rental boundaries |
| 124 | Tenant isolation checks | Not applicable | Single-tenant Fast Rental deployment, not a multi-tenant SaaS |
| 125 | Per-tenant rate limits and quotas | Adapt | Global API/public rate limits plus per-listing media quotas (`MAX_IMAGES_PER_LISTING`, `MAX_VIDEOS_PER_LISTING`) and DB RPC reservation |
| 126 | Multipart upload limits | Adapt / verify | Production uses presigned single-object PUTs, not multipart forms; local dev proxy route rejects `multipart/*` and raw body remains capped at `MAX_VIDEO_SIZE_MB` |
| 127 | MIME validation via content inspection | Implement | Magic-byte sniffing on upload completion/proxy validates declared MIME; mismatches delete the stored object and return 400 |
| 128 | Randomized upload filenames | Verify existing | Object keys use `randomUUID()` segments (`listings/{id}/{uuid}/…`, `profiles/{userId}/{uuid}/…`) with sanitized original names stored separately |
| 129 | Store uploads outside public web roots | Verify existing | Production media lives in private R2; local dev uses gitignored `.local-storage` served only through authenticated `/api/storage/object` lookups |
| 130 | Path traversal prevention | Strengthen | `assertSafeObjectKey` enforces allowed prefixes and resolved-path containment; storage download route validates keys before read |
| 131 | Signed URLs for protected media | Verify existing | R2 presigned PUT/GET with short TTLs; public consumers only receive approved media via projected responses |
| 132 | Malware/DLP scanning on uploads | Defer | Trusted internal agents upload photos/videos only; ClamAV/DLP is an operational upgrade if compliance requires it |
| 133 | ZIP/archive bomb protection | Not applicable | Only image/video MIME types are accepted; archives are rejected at MIME and magic-byte layers |
| 134 | Image decompression/dimension limits | Implement | JPEG/PNG/WebP headers parsed on inspection; images above `MAX_IMAGE_PIXEL_DIMENSION` (8192px) are rejected |
| 135 | Temporary upload auto-cleanup | Verify existing | `cleanupStaleMediaReservations` deletes pending reservations and R2 objects after 24 hours |
| 136 | WebSocket auth/origin/size/rate limits | Not applicable | No WebSocket endpoints in the application |
| 137 | WebSocket gateway auth parity | Not applicable | No WebSocket gateway |
| 138 | gRPC auth/size/deadlines | Not applicable | HTTP/JSON Express API only |

Tests: `media-content-inspection.test.ts`, `media.test.ts` (multipart rejection).

## Chunk 13 — Integrations, outbound safety, caching, and deployment controls (2026-07-16)

| # | Proposal | Decision | Implementation |
|---|----------|----------|----------------|
| 139 | Webhook signature verification and replay protection | Not applicable | No inbound webhook endpoints; Supabase/Resend callbacks are not consumed by this API |
| 140 | Queue/job endpoint authentication | Verify existing | Cron jobs run in-process only; `/api/admin/sheets/*`, `/api/admin/geocode/run`, and maintenance scripts require auth + admin permissions (+ action tokens on imports) |
| 141 | Worker-to-API service authentication | Not applicable | No separate worker tier calling the API |
| 142 | Message queue payload signing/encryption | Not applicable | No message broker in the architecture |
| 143 | SSRF protection for server-side fetches | Implement | `fetchAllowlisted` enforces configured origin allowlist, blocks private/metadata hostnames, rejects redirects, and applies fetch timeouts; geocoding uses it exclusively |
| 144 | DNS rebinding protection | Verify existing | Production Host allowlist, loopback Node bind, loopback-only proxy trust, and HTTPS redirects mitigate rebinding against the admin/API surface |
| 145 | Circuit breakers for downstream API failures | Adapt | Geocoding failures are isolated per listing; batch continues with structured logging. Dedicated breaker library deferred unless provider outage volume warrants it |
| 146 | Retry storm protection and backoff | Verify existing | Nominatim geocoding serializes requests with ≥1.1s spacing; API rate limits and Retry-After headers protect Express endpoints |
| 147 | Cache poisoning protection | Verify existing | Authenticated `/api/*` responses use `Cache-Control: no-store`; public listings are identical for all callers and served without credentialed CORS |
| 148 | Redis/Memcached authentication and isolation | Not applicable | No Redis/Memcached cache layer; Postgres `geocode_cache` is server-side only |
| 149 | Secure cache key design | Verify existing | Geocode cache keys are normalized addresses in Postgres, not shared reverse-proxy cache keys derived from user input |
| 150 | Audit log tamper resistance / append-only storage | Operational / defer | Activity rows live in Supabase Postgres; immutability depends on DB privileges and backup policy rather than WORM storage |
| 151 | Read-only DB roles / read replicas for reporting | Not applicable | Backend requires service role for authorized mutations; no separate reporting replica API |
| 152 | Blue/green or canary rollback safety | Operational | PM2 restart + Vercel instant rollback documented; no dual-version traffic splitting in this deployment |
| 153 | Signed build artifacts and provenance verification | Operational | CI uses committed `package-lock.json` with `npm ci`, secret scanning, and audit; SLSA/provenance signing deferred |
| 154 | Infrastructure drift detection | Operational | VPS/Caddy/Supabase configuration tracked in repo docs/scripts; automated drift scanning deferred |
| 155 | Admin route IP allowlisting | Rejected | Removed per deployment decision; admin routes rely on JWT, MFA (AAL2), and named permissions only |
| 156 | OpenID Connect / OAuth callback validation | Not applicable | Authentication is Supabase email/password + TOTP; no first-party OAuth/OIDC callback routes |
| 157 | Claims normalization preventing IDP role grant | Verify existing | Internal `admin`/`agent` role is read from `agents` on every API request, never trusted directly from JWT app metadata alone |
| 158 | Restrict compression on secret-bearing responses | Implement | `compression` filter disables gzip for authenticated private `/api/*` routes to reduce BREACH-style risk on entry codes and lead PII |

Tests: `outbound-fetch.test.ts`, `security-headers.test.ts`.

## Chunk 14 — Parsers, platform hardening, and deployment boundaries (2026-07-16)

| # | Proposal | Decision | Implementation |
|---|----------|----------|----------------|
| 159 | XML DTD/XXE hardening | Not applicable | Application accepts JSON and bounded binary uploads only; no user-supplied XML parser path. AWS SDK XML usage is internal to S3/R2 clients |
| 160 | Sandbox YAML/CSV/archive/PDF/document parsers | Adapt / verify | Google Sheets import uses the official API (not user-uploaded CSV/YAML/PDF). Listing media is constrained to image/video magic-byte inspection with dimension limits |
| 161 | Safe outbound process execution | Verify existing | Backend runtime (`apps/backend/src`) does not invoke `child_process`; deployment scripts remain operator-only outside the API process |
| 162 | Outbound TLS validation preserved | Verify existing | Node fetch/HTTPS clients use default certificate validation; no custom insecure TLS bypass in application code |
| 163 | Mutual TLS for service-to-service endpoints | Not applicable | No mTLS client-certificate endpoints in this architecture |
| 164 | GraphQL depth/complexity/persisted queries | Not applicable | REST/JSON API only |
| 165 | SSE/streaming API controls | Not applicable | Node server explicitly rejects HTTP `upgrade`/CONNECT; no SSE endpoints |
| 166 | Background worker least privilege and poison handling | Verify existing | Cron jobs run in-process with server env credentials; failures are logged per job and do not crash the API; stale media cleanup is best-effort/idempotent |
| 167 | Database migrations separated from app startup | Verify existing | Migrations apply via `npm run db:push` / operator scripts; `server.ts` starts HTTP + cron only |
| 168 | ORM tenant/global filter validation | Not applicable | Single-tenant app; authorization uses explicit service-layer filters rather than shared multi-tenant ORM scopes |
| 169 | Request decompression controls | Implement | `rejectCompressedRequestBody` returns 415 for incoming `Content-Encoding` (`gzip`, `deflate`, `br`, etc.) before body parsers run |
| 170 | Runtime configuration schema validation | Verify existing | `config/env.ts` Zod schema validates secrets, URLs, origins, ports, feature flags, and production HTTPS constraints at startup |
| 171 | Dynamic CORS/CSP/redirect/cookie config from validated server config | Verify existing | CORS uses validated `FRONTEND_ORIGIN`; production CSP is injected at build from validated `VITE_*` URLs; redirects are fixed paths; no auth cookies |
| 172 | Payment provider SDK/webhook validation | Not applicable | No checkout, payments, or payment webhooks in Fast Rental |

Tests: `request-boundary.test.ts`; security checklist extended for migration separation, env validation, compressed-body rejection, and no runtime shell-outs.

## Chunk 15 — React frontend delivery and browser auth model (2026-07-16)

| # | Proposal | Decision | Implementation |
|---|----------|----------|----------------|
| 173 | React CSP tuned for bundles/CDNs with nonce/hash | Verify existing / adapt | Production Vite build injects a strict CSP meta tag: `script-src 'self'` (bundled chunks, no inline scripts), exact `connect-src` for API/Supabase/R2/maps, `style-src 'self' 'unsafe-inline'` for React `style` props. Nonce/hash not required because the app does not serve inline scripts or third-party script CDNs. Vercel edge headers add a matching baseline (`vercel.json`) |
| 174 | CORS scoped to React application origins | Verify existing | Express CORS uses exact validated `FRONTEND_ORIGIN` list, `credentials: false`, explicit methods/headers. R2 upload CORS is limited to the agent frontend origin (`deploy/r2-cors.json`) |
| 175 | CSRF protection for cookie-based React auth | Not applicable | SPA authenticates API calls with explicit `Authorization: Bearer` headers; no ambient auth cookie is sent to the VPS API. Supabase session storage is separate from API CORS credentials. CSRF becomes mandatory only if auth migrates to cookies |
| 176 | Secure WebSocket auth and origin checks | Not applicable / provider | No first-party WebSocket endpoints; Node rejects HTTP `upgrade`. Supabase client may use `wss:` for provider realtime; production CSP allows only the configured Supabase WebSocket origin. Custom React realtime channels are not implemented |

Tests/checklist: `security-headers.test.ts`, `run-security-checklist.mjs` (frontend CSP + CORS checks).

## MFA removal (2026-07-16)

Admin TOTP / AAL2 enforcement was removed per deployment decision. Admin routes now rely on JWT auth, named `requirePermission(...)` scopes, and action tokens for sensitive flows only.

Removed: `MfaChallengePage`, `MfaSettings`, `/auth/mfa` route, backend `MFA_REQUIRED` / AAL checks, and related tests/scripts/docs.

## Frontend chunk 1 — XSS, URL safety, and client secrets (2026-07-16)

User chunk covered React output escaping, URL validation, open redirects, env exposure, HTTPS/mixed content, and browser storage.

| # | Proposal | Decision | Implementation |
|---|----------|----------|----------------|
| 1 | Escape JSX by default / avoid `dangerouslySetInnerHTML` | Verify existing | No `dangerouslySetInnerHTML` in frontend; React text escaping is the default |
| 2 | Sanitized `dangerouslySetInnerHTML` only | Not applicable | App renders no rich HTML or CMS content |
| 3 | DOMPurify for rendered HTML | Defer | No markdown/rich-text rendering path today |
| 4 | DOM XSS from URL/storage state | Implement | Search filters sanitize control chars and enum-bound `statut`/`taille`/`source`; `esc()` remains on agent-facing listing text |
| 5 | Validate dynamic URLs | Implement | `urlSafetyCore.ts` validates media, download, and upload URLs before `src`, `fetch`, or `window.open` |
| 6 | Block unsafe URL schemes | Implement | `javascript:`, `vbscript:`, `file:`, and unexpected `data:`/`blob:` media URLs rejected |
| 7 | Prevent open redirects | Verify + strengthen | No `returnUrl`/`next` params; `isSafeInternalPath` guards relative navigation; password reset stays on `window.location.origin` |
| 8 | `rel="noopener noreferrer"` on `_blank` | Implement | `openUrlSafely` opens downloads with `noopener,noreferrer` |
| 9 | `CSS.escape` for dynamic selectors | Not applicable | Status badges and tones use fixed lookup tables, not user-controlled selectors |
| 10 | Sanitize dynamic CSS/class/style input | Verify existing | No user-derived class names, CSS variables, or inline styles |
| 11 | No secrets in client bundle | Verify + document | Only `VITE_*` public URLs and Supabase anon key; `.env.example` documents exposure |
| 12 | Treat build-time env vars as public | Implement | Comment + validation in `env.ts`; service-role keys remain backend-only |
| 13 | HTTPS-only asset/API endpoints | Implement | Production `env.ts` and Vite build fail on non-HTTPS `VITE_*` URLs |
| 14 | Detect mixed-content URLs at build | Implement | `vite.config.ts` rejects HTTP service URLs during production builds |
| 15 | Non-sensitive browser storage only | Verify + document | App code stores nothing manually; Supabase session persistence documented in `supabaseClient.ts` |

Also fixed referral links to use admin-managed `referral_slug` instead of derived `nom`.

Tests: `apps/backend/tests/frontend-url-safety.test.ts`.

## Frontend chunk 2 — Auth state, caches, and client session hygiene (2026-07-16)

| # | Proposal | Decision | Implementation |
|---|----------|----------|----------------|
| 16 | Prefer in-memory bearer token storage | Adapt | Supabase session moved from `localStorage` to tab-scoped `sessionStorage`; pure in-memory rejected because agents need refresh-safe sessions during showings |
| 17 | Do not persist secrets/tokens in app stores | Implement | Tokens remain in Supabase auth storage only; React context holds profile metadata, not JWT material; query cache cleared on logout/account switch |
| 18 | Prevent sensitive data in telemetry/debug state | Implement | Removed admin/leads debug `console.*` calls; production Vite build drops `console`/`debugger`; no analytics SDK present |
| 19 | Auto-clear auth/client state on logout/failure | Implement | `clearClientSession` aborts API calls and clears TanStack Query cache on logout, 401, session loss, and account switch |
| 20 | Cancel in-flight authenticated requests on logout | Implement | Shared `AbortController` wired into `apiClient`; requests are not cancelled on tab blur (`refetchOnWindowFocus: false`) |
| 21 | Hide protected routes until auth verified | Verify existing | `AuthProvider` and `ProtectedRoute` render spinners until profile load completes |
| 22 | Prevent flash of protected content | Verify existing | App routes mount only after `AuthProvider` finishes initial session verification |
| 23 | Route guards are UX only | Document | Comment added to `ProtectedRoute`; backend JWT/permission checks remain authoritative |
| 24 | Mirror server authorization in admin UI | Verify existing | Admin routes/components gated by `ProtectedRoute role="admin"` and `isAdmin` nav checks; non-admins redirect to search |
| 25 | Lazy-load sensitive modules after authorization | Implement | `AdminPanel` and listing admin pages now lazy-load behind admin route guard + `Suspense` |
| 26 | Loading states must not leak prior-user data | Implement | Query cache cleared on logout/account switch; suspense fallbacks are generic spinners only |
| 27 | Error boundaries must not expose internals | Implement | `AppErrorBoundary` shows generic recovery copy; detailed stacks logged only in development |
| 28 | Remove debug logs from production builds | Implement | Debug logs removed from source and stripped by Vite `esbuild.drop` in production |
| 29 | Client-side CSRF for cookie auth | Not applicable | API auth uses explicit Bearer headers with `credentials: 'omit'`; no cookie session to the VPS API |
| 30 | Attach credentials only to trusted API calls | Implement | All `apiClient` fetches use `credentials: 'omit'`; Bearer token sent explicitly |

Tests: `apps/backend/tests/frontend-auth-session.test.ts`.

## Frontend chunk 3 — Validation, forms, and client integrity (2026-07-16)

| # | Proposal | Decision | Implementation |
|---|----------|----------|----------------|
| 31 | Runtime validation at trust boundaries | Implement | Shared Zod schemas (`agentProfileSchema`, `listingDetailSchema`, `adminUserSchema`, `uuidParamSchema`) parsed in `parseApi` and `formValidation` |
| 32 | TypeScript strictness / avoid unsafe casts | Verify + strengthen | `strict: true` retained; removed `Record<string, unknown>` listing casts and unsafe traitement-status casts |
| 33 | Client-side input validation before submit | Implement | Login, password, listing, admin user, and phone updates validated with shared Zod schemas before API calls |
| 34 | Client validation is UX only | Document | Comment in `formValidation.ts`; backend remains authoritative |
| 35 | Disable repeated submits / UI locks | Implement | `useSubmitLock` on login-adjacent flows, listing CRUD, admin user creation, and profile mutations |
| 36 | Idempotent UI locks for payments/reservations | Not applicable | No checkout, payment, preorder, or reservation flows in Fast Rental |
| 37 | Rate-limit abuse-prone buttons | Implement | Password reset button rate-limited for 60s via `useRateLimitedAction` |
| 38 | Mask password fields with reveal toggles | Implement | Shared `PasswordInput` component with show/hide control |
| 39 | Disable autocomplete on sensitive fields | Adapt | New-password fields use `autocomplete="new-password"`; email-change confirmation fields use `autocomplete="off"` |
| 40 | Block password managers on decoy fields | Not applicable | No decoy/hidden credential fields in this UI |
| 41 | Warn before leaving unsaved forms | Implement | `useBeforeUnload` on listing create/edit drafts |
| 42 | Use `crypto.getRandomValues()` | Implement | `secureRandomId()` utility for future client-generated identifiers |
| 43 | Validate localized / translated content | Not applicable | French copy is static in source; no runtime i18n/CMS injection path |
| 44 | Validate numbers/currency before render | Implement | `formatCurrency()` rejects non-finite values before display |
| 45 | Prevent excessive client loops/DOM updates | Verify existing | Search debounce, bounded pagination, and capped filter params remain in place |
| 46 | Immutable state / safe merges | Verify existing | React state updates continue to use object spreads rather than in-place mutation |
| 47 | Feature flags display-only | Not applicable | No client-side authorization feature flags |
| 48 | Freeze runtime frontend config | Implement | `env` object frozen after Zod validation |
| 49 | React Strict Mode in development | Verify existing | Enabled in `main.tsx` |
| 50 | Feature-detect browser security APIs | Implement | Clipboard copy and secure random generation fail safely when APIs are unavailable |
| 51 | Pin dependency versions with lockfiles | Verify existing | Root `package-lock.json` committed; CI uses `npm ci` |
| 52 | Audit frontend dependencies | Verify existing | Root `npm run audit:deps` and CI audit job |
| 53 | Remove unused packages | Implement | Unused `clsx` dependency removed from frontend |
| 54 | Restrict production source maps | Verify existing | Vite production builds omit source maps; Vercel blocks `*.map` |
| 55 | Version-check bundles after releases | Implement | `VITE_BUILD_ID` injected at build time; `enforceCurrentAppBuild()` reloads stale tabs |

Tests: `apps/backend/tests/frontend-form-validation.test.ts`.

## Frontend input sanitization and typed fields (2026-07-16)

Hardened all user-editable fields with typed sanitizers, shared submit-time cleaning, and `SanitizedInput`/`SanitizedTextarea` wrappers.

| Control | Implementation |
|---------|----------------|
| SQL/script injection resistance | Control chars, angle brackets, and backticks stripped; phone/money/decimal fields character-restricted; shared Zod validation still runs before every API call |
| XSS | React escaping retained; stored text sanitized to remove `<>` before submit; comments use `esc()` at render |
| CORS / CSRF | Documented in `apiClient.ts`: `credentials: 'omit'`, Bearer auth only; CORS enforced on backend `FRONTEND_ORIGIN` |
| Phone numbers | `phone` kind allows digits and `+().- ` only; normalized to digits before API (`normalizePhoneForApi`) |
| Money / coordinates | `money` digits-only; `decimal` allows one signed decimal point |
| Names / addresses | `personName` unicode letters only; `address`/`plain`/`search` text without markup chars |
| Enum/select fields | Whitelist validation unchanged for filters, roles, statut, taille |

Tests: `apps/backend/tests/frontend-input-sanitize.test.ts`.
