# Zero-gap master checklist (Phase 27)

All 46 plan phases are implemented in this repository. Verify with:

```bash
npm run verify-plan
```

This runs artifact checks for every phase, then `npm run build` and `npm run test`.

## Per-phase verification commands

| Phase | Command / artifact |
|-------|-------------------|
| p1 | `.nvmrc` → `nvm use` |
| p4 | `npm run verify-supabase-auth` (live) · offline: `node scripts/verify-supabase-auth-offline.mjs` |
| p8 apply | `npm run backup-db` then `npm run db:push` |
| p8 verify | `npm run verify-migrations` · offline: `node scripts/verify-migrations-offline.mjs` |
| p11 | `npm run verify-r2` + `deploy/r2-cors.json` · offline: `node scripts/verify-r2-offline.mjs` |
| p19 | `npm run test` |
| p20 | `npm run smoke` + [smoke-test.md](./smoke-test.md) |
| p21–p25 | `npm run apply-ops` (offline + live when creds set) · `node scripts/verify-deploy-ready.mjs` |
| p26 | `npm run verify-email` |

## Known project values

- Supabase project: `twkqsaupojldddclgpqj`
- Local frontend: `http://localhost:5173`
- Local backend: `http://localhost:4000`
- Union Rental URL (referral links): `http://localhost:5174` local

## Definition of Done

`npm run verify-plan` exits 0 → all 46 phases complete in repo (code + offline ops).

`npm run apply-ops` → offline ops applied; live steps run automatically when real keys are in `apps/backend/.env`.

Live production sign-off still requires: real Supabase keys, R2 token, domain DNS, and manual UI smoke from [smoke-test.md](./smoke-test.md).
