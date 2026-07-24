# Fast Rental — Logigo Agent Full Stack

Monorepo for the Logigo Agent portal (Fast Rental).

## Structure

- `apps/frontend` — React + Vite agent/admin UI (Vercel)
- `apps/backend` — Express API (Hostinger VPS + Caddy)
- `shared` — Types, constants, Zod schemas
- `supabase/migrations` — Postgres schema migrations
- `legacy/index.html` — Original single-file app (reference)

## Local setup

```bash
cd "/home/frenki/Documents/Fast Rental"
npm run start:local
```

Opens http://localhost:5173/agent-login after checks pass. First time only: fill in `.env` files when prompted, then create admin:

```bash
INITIAL_ADMIN_EMAIL=you@example.com \
INITIAL_ADMIN_PASSWORD='YourPassword' \
INITIAL_ADMIN_NAME='Your Name' \
npm run create-initial-admin
```

One-time manual setup (if you prefer):

```bash
npm install
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
# Fill Supabase, R2, Google keys — see docs/supabase-auth-setup.md
npm run verify-env
npx supabase login && npm run db:push
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev:backend` | API on http://localhost:4000 |
| `npm run dev:frontend` | UI on http://localhost:5173 |
| `npm run build` | Build shared + backend + frontend |
| `npm run test` | Backend Vitest suite |
| `npm run smoke` | Build, test, health check |
| `npm run db:push` | Apply Supabase migrations |
| `npm run cutover` | Apply migration 0006 (when both apps live) |
| `npm run create-test-agent` | Skander test agent (Phase 25) |

## Master checklist (46 plan phases)

See [docs/zero-gap-guide.md](docs/zero-gap-guide.md).

## Login URL

No public login button. Agents use: `http://localhost:5173/agent-login`

Referral links use `VITE_PUBLIC_SITE_URL` (Union Rental public site).

## Supabase

Reuse project `twkqsaupojldddclgpqj`. Apply migrations:

```bash
npx supabase login
npx supabase link --project-ref twkqsaupojldddclgpqj
npx supabase db push
```

## Deployment

See [docs/deployment.md](docs/deployment.md).

## Production checklist

See [docs/operations.md](docs/operations.md).

## Security

- [docs/security-threat-model.md](docs/security-threat-model.md) — architecture, trust boundaries, residual risks
- [docs/security-checklist.md](docs/security-checklist.md) — pre/post deploy verification
- [docs/production-go-live-checklist.md](docs/production-go-live-checklist.md) — customer handoff sign-off
- [docs/security-hardening-log.md](docs/security-hardening-log.md) — implemented controls log
