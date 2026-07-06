# Local Development (Phase 20)

1. Install Node 22+ (`nvm use`).
2. Copy `.env.example` to `.env` in `apps/backend` and `apps/frontend`.
3. Configure Supabase, R2, Google Sheets, and Resend per [supabase-auth-setup.md](./supabase-auth-setup.md) and [r2-setup.md](./r2-setup.md).
4. Run `npm run verify-env`.
5. Link and apply migrations:

```bash
npx supabase login
npx supabase link --project-ref twkqsaupojldddclgpqj
npm run db:push
```

6. Create admin: `npm run create-initial-admin`
7. Optional test agent: `npm run create-test-agent`
8. Start backend: `npm run dev:backend`
9. Start frontend: `npm run dev:frontend`
10. Open http://localhost:5173/agent-login

## Automated smoke

```bash
npm run smoke
```

Full manual checklist: [smoke-test.md](./smoke-test.md)

Master checklist for all 46 plan phases: [zero-gap-guide.md](./zero-gap-guide.md)
