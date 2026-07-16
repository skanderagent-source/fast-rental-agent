# Fast Rental security threat model

Living document for production hardening. Update when new controls are added or risks change.

## Application purpose

Internal **LogiGo Agent** portal for Montreal rental agents and admins:

- Search and manage rental listings (`logements`)
- Assign and progress client leads (`demandes_clients`)
- Upload listing media to private Cloudflare R2
- Generate referral links to the public **Union Rental** site
- Admin: user management, Google Sheets import, geocoding, email

## Trust boundaries

| Boundary | Mechanism | Notes |
|----------|-----------|-------|
| Browser → Vercel | Static SPA + public `VITE_*` | Supabase anon key is intentionally public |
| Browser → VPS API | Bearer JWT | Validated via Supabase `getUser()` + `agents.actif` |
| Browser → Supabase Auth | Password reset, session | Dashboard: sign-up disabled, redirect whitelist |
| VPS API → Supabase | Service role key | **Bypasses RLS** — all authz in Express layer |
| Browser → R2 | Presigned PUT (production) | Bucket private; CORS limited to agent origin |
| Public → `/api/public` | Unauthenticated reads | Field allowlist + rate limit |

## Data classification

| Data | Sensitivity | Who may access |
|------|-------------|----------------|
| Entry codes, concierge phone, tenant contact | High | Authenticated agents (trusted workforce) |
| Lead PII (phone, email, income) | High | Assigned agent + admin |
| Listing photos/videos | Medium | Agents internally; public sees approved only |
| Public listing fields | Low | `/api/public` consumers (Union Rental) |

## Implemented controls (code)

- JWT authentication with inactive-account gate
- Admin RBAC on sensitive routes
- Zod validation on mutating endpoints
- Public listing field allowlist (`pickPublic`)
- Approved-media gate for anonymous downloads
- Media upload quotas via DB RPC
- Lead assignment via hardened RPC + triggers
- Helmet and edge security headers (CSP, HSTS, anti-clickjacking,
  nosniff, Referrer-Policy, Permissions-Policy)
- Caddy/Node HTTPS redirects and hidden Express/Caddy technology headers
- Exact-origin, non-credentialed API CORS with explicit methods/headers
- Production frontend CSP with exact API/Supabase origins and no inline scripts
- Rate limits (public + authenticated API)
- Explicit API route/method/preflight registry with consistent 404/405 responses
- Production Host allowlist, loopback-only proxy trust, and loopback Node binding
- Ambiguous HTTP request/path rejection and blocked TRACE/TRACK/CONNECT
- Node/Caddy header-size, body-size, request, header, keep-alive, and idle limits
- Strict bounded Zod body/query schemas and UUID validation for route parameters
- Outbound Zod projection on public listing/media responses
- JSON/HTML output escaping and comment HTML stripping
- Duplicate-query and dangerous object-key rejection
- Writable-field DTO allowlists before listing persistence
- Supabase parameterized query builder/RPC use; no runtime raw SQL or NoSQL datastore
- No dynamic code evaluation or untrusted YAML/object revival
- Sanitized PostgREST search terms
- Capped listing scan size for search endpoints
- Generic 5xx error messages to clients
- Password policy (10+ chars, letter + digit)
- Profile photo ID ownership validation
- Stale media cleanup deletes R2 objects
- Admin test-email recipient validation

## Residual risks

| Risk | Severity | Mitigation path |
|------|----------|-----------------|
| Service-role key compromise | Critical | VPS hardening, secret rotation, monitoring |
| Compromised agent account | High | Account review, audit logs, administrative deactivation |
| Signed URL sharing | Medium | Short TTL (300s); acceptable for agent workflow |
| No APM/alerting | Medium | Add uptime monitor + error tracking post-launch |
| Media auto-approved on upload | Low | Intentional for agent velocity; admin reject path exists |

## Verification commands

```bash
npm run verify-env
npm run security-checklist
npm run build
npm run test
npm run smoke
```

Live (requires credentials):

```bash
npm run verify-supabase-auth
npm run verify-migrations
npm run verify-r2
npm run verify-dns
```

See also [security-checklist.md](./security-checklist.md) and [production-go-live-checklist.md](./production-go-live-checklist.md).
