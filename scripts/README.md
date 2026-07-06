# Scripts

## verify-plan (all 46 phases)

```bash
npm run verify-plan
```

Checks every plan phase artifact, then runs build + tests.

## Environment

| Script | Phase |
|--------|-------|
| `npm run verify-env` | Env file validation |
| `npm run verify-supabase-auth` | p4 — anon signup blocked |
| `npm run verify-migrations` | p8 — schema objects exist |
| `npm run verify-r2` | p11 — bucket connectivity |
| `npm run verify-email` | p26 — Resend config |
| `npm run verify-cutover` | p25 — legacy + lockdown state |
| `npm run verify-dns` | p23 — DNS resolution |
| `npm run security-checklist` | p24 — automated security checks |

## Setup

| Script | Phase |
|--------|-------|
| `npm run backup-db` | p4 — database backup |
| `npm run db:push` | p8 — apply migrations |
| `npm run create-initial-admin` | First admin user |
| `npm run create-test-agent` | p25 — Skander test agent |
| `npm run cutover` | p25 — apply 0006 migration |

## Deploy

| Script | Phase |
|--------|-------|
| `npm run deploy:vercel` | p21 |
| `bash scripts/vps-first-time-setup.sh` | p22 — once on VPS |
| `npm run deploy:vps` | p22 — on VPS after clone |
| `node scripts/post-dns-checklist.mjs` | p23 — post-DNS env list |

## Local

```bash
npm run smoke
```

See [docs/zero-gap-guide.md](../docs/zero-gap-guide.md).
