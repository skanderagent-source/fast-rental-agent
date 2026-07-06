# Supabase Auth dashboard setup (Phase 4)

Project ref: `twkqsaupojldddclgpqj`

## Before cutover

1. **Backup**: `npx supabase db dump -f backup-$(date +%F).sql`
2. **Authentication → Providers**: Email enabled; disable public sign-ups
3. **Authentication → URL Configuration**:
   - Site URL: production agent frontend (e.g. `https://agent.your-domain.com`)
   - Redirect URLs (add all):
     - `http://localhost:5173/auth/reset-password`
     - `http://localhost:5173/auth/force-password-change`
     - `https://YOUR_FRONTEND_DOMAIN/auth/reset-password`
     - `https://YOUR_FRONTEND_DOMAIN/auth/force-password-change`
4. Record keys in `apps/backend/.env` and `apps/frontend/.env`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (backend only)

## After cutover (Phase 26)

Configure Custom SMTP via Resend in Supabase Auth → SMTP Settings.

## Verification

```bash
npm run verify-env
npm run create-initial-admin
curl -s http://localhost:4000/health
```

Attempt sign-up via Supabase client should fail when sign-ups are disabled.
