#!/usr/bin/env node
/**
 * Phase 23: Post-DNS env refresh checklist (prints required updates).
 */
const api = process.env.API_DOMAIN ?? 'api.your-domain.com';
const front = process.env.FRONTEND_DOMAIN ?? 'agent.your-domain.com';
const union = process.env.UNION_DOMAIN ?? 'your-union-domain.com';

console.log(`
After DNS propagates, update:

apps/backend/.env:
  PUBLIC_API_BASE_URL=https://${api}
  FRONTEND_ORIGIN=https://${front}

apps/frontend/.env (Vercel):
  VITE_API_BASE_URL=https://${api}
  VITE_PUBLIC_SITE_URL=https://${union}

Supabase Auth redirect URLs:
  https://${front}/auth/reset-password
  https://${front}/auth/force-password-change

R2 CORS (deploy/r2-cors.json):
  Add https://${front}

Then:
  pm2 restart fast-rental-api
  npm run deploy:vercel
`);
