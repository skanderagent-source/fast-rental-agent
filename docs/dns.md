# DNS configuration (Phase 23)

## Records

| Host | Type | Target |
|------|------|--------|
| `agent.your-domain.com` (or chosen subdomain) | CNAME | Vercel DNS |
| `api.your-domain.com` | A | VPS public IP |

## After DNS propagates

1. Update `apps/backend/.env`:
   - `PUBLIC_API_BASE_URL=https://api.your-domain.com`
   - `FRONTEND_ORIGIN=https://agent.your-domain.com`
2. Update Vercel env:
   - `VITE_API_BASE_URL=https://api.your-domain.com`
3. Update Supabase redirect URLs (see `docs/supabase-auth-setup.md`)
4. Update R2 CORS (see `docs/r2-setup.md`)
5. `pm2 restart fast-rental-api`
6. Redeploy Vercel frontend

## Verification

```bash
curl https://api.your-domain.com/health
curl -I https://agent.your-domain.com
```
