#!/usr/bin/env node
/**
 * Verifies all 46 plan phases have required repo artifacts.
 * Run: npm run verify-plan
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { rootDir } from './lib/env.mjs';

const root = rootDir();

/** @type {Array<{ id: string; check: () => boolean | string }>} */
const phases = [
  { id: 'p27-zero-gap-guide', check: () => fs.existsSync('docs/zero-gap-guide.md') },
  { id: 'p1-prerequisites', check: () => fs.existsSync('.nvmrc') && fs.readFileSync('.nvmrc', 'utf8').includes('22') },
  { id: 'p2-monorepo', check: () => fs.existsSync('package.json') && fs.existsSync('apps/frontend') && fs.existsSync('apps/backend') },
  { id: 'p3-shared-package', check: () => fs.existsSync('shared/src/index.ts') },
  { id: 'p4-supabase-auth', check: () => fs.existsSync('scripts/verify-supabase-auth.mjs') && fs.existsSync('docs/supabase-auth-setup.md') && fs.existsSync('scripts/verify-supabase-auth-offline.mjs') },
  { id: 'p5-migration-0001', check: () => fs.existsSync('supabase/migrations/0001_init.sql') },
  { id: 'p6-migration-0002-rls', check: () => fs.existsSync('supabase/migrations/0002_rls.sql') },
  { id: 'p7-migration-0003-triggers', check: () => fs.existsSync('supabase/migrations/0003_functions_and_triggers.sql') },
  { id: 'p8-migration-0004-seed', check: () => fs.existsSync('supabase/migrations/0004_seed_admin.sql') },
  { id: 'p8-migration-0005-backfill', check: () => fs.existsSync('supabase/migrations/0005_backfill_assigned_leads.sql') },
  { id: 'p8-admin-scripts', check: () => fs.existsSync('scripts/create-initial-admin.mjs') && fs.existsSync('scripts/verify-env.mjs') },
  { id: 'p8-apply-migrations', check: () => fs.existsSync('scripts/apply-migrations.mjs') && fs.existsSync('scripts/verify-migrations.mjs') && fs.existsSync('scripts/verify-migrations-offline.mjs') },
  { id: 'p9-backend-skeleton', check: () => fs.existsSync('apps/backend/.env.example') },
  { id: 'p9-backend-core', check: () => fs.existsSync('apps/backend/src/app.ts') && fs.existsSync('apps/backend/src/server.ts') },
  { id: 'p10-auth-profile-routes', check: () => fs.existsSync('apps/backend/src/modules/auth/auth.routes.ts') },
  { id: 'p10-user-admin-routes', check: () => fs.existsSync('apps/backend/src/modules/users/users.routes.ts') },
  { id: 'p10-listing-routes', check: () => fs.existsSync('apps/backend/src/modules/listings/listings.routes.ts') && fs.existsSync('apps/backend/src/modules/listings/listings.repository.ts') },
  { id: 'p10-media-routes', check: () => fs.existsSync('apps/backend/src/modules/media/r2.service.ts') },
  { id: 'p10-lead-routes', check: () => fs.existsSync('apps/backend/src/modules/leads/leads.routes.ts') },
  { id: 'p10-comments-routes', check: () => fs.existsSync('apps/backend/src/modules/comments/comments.routes.ts') },
  { id: 'p10-admin-stats-rentals', check: () => fs.existsSync('apps/backend/src/modules/rentals/rentals.routes.ts') },
  { id: 'p10-sheets-sync', check: () => fs.existsSync('apps/backend/src/modules/sheets/sheets.service.ts') },
  { id: 'p10-cron-jobs', check: () => fs.existsSync('apps/backend/src/modules/jobs/startJobs.ts') },
  { id: 'p26-resend-email', check: () => {
    const tpl = fs.readFileSync('apps/backend/src/modules/email/templates.ts', 'utf8');
    const svc = fs.readFileSync('apps/backend/src/modules/email/email.service.ts', 'utf8');
    return fs.existsSync('scripts/verify-email.mjs')
      && tpl.includes('export function leadAssignedAgent')
      && tpl.includes('export function accountCreated')
      && svc.includes('export async function sendEmail')
      && svc.includes('logger.error')
      && !svc.includes('throw err');
  }},
  { id: 'p11-r2-setup', check: () => fs.existsSync('deploy/r2-cors.json') && fs.existsSync('scripts/verify-r2.mjs') && fs.existsSync('scripts/verify-r2-offline.mjs') },
  { id: 'p12-frontend-setup', check: () => fs.existsSync('apps/frontend/src/lib/apiClient.ts') },
  { id: 'p13-routing-auth-shell', check: () => fs.existsSync('apps/frontend/src/app/routes.tsx') },
  { id: 'p14-login', check: () => fs.existsSync('apps/frontend/src/features/auth/LoginPage.tsx') && fs.existsSync('apps/frontend/src/features/auth/authApi.ts') && fs.existsSync('apps/frontend/src/features/auth/validation.ts') },
  { id: 'p14-force-password', check: () => fs.existsSync('apps/frontend/src/features/auth/ForcePasswordChangePage.tsx') && fs.existsSync('apps/frontend/src/features/auth/PasswordRecoveryPage.tsx') },
  { id: 'p14-search-panel', check: () => fs.existsSync('apps/frontend/src/features/agent/SearchPanel.tsx') },
  { id: 'p14-listing-cards', check: () => fs.existsSync('apps/frontend/src/components/listings/ApplicationMessageModal.tsx') },
  { id: 'p14-add-listing-admin', check: () => fs.existsSync('apps/frontend/src/features/admin/AddListingPage.tsx') },
  { id: 'p14-demandes', check: () => fs.existsSync('apps/frontend/src/features/agent/DemandesPanel.tsx') },
  { id: 'p14-admin-panel', check: () => fs.existsSync('apps/frontend/src/features/admin/AdminPanel.tsx') },
  { id: 'p14-map', check: () => fs.existsSync('apps/frontend/src/features/agent/MapPanel.tsx') },
  { id: 'p15-styling', check: () => fs.existsSync('apps/frontend/src/styles/theme.css') && fs.existsSync('apps/frontend/src/components/common/Modal.tsx') },
  { id: 'p16-public-site', check: () => !fs.existsSync('index.html') && fs.existsSync('legacy/index.html') },
  { id: 'p17-user-dashboard', check: () => fs.existsSync('apps/frontend/src/features/dashboard/UserDashboard.tsx') },
  { id: 'p18-activity-logging', check: () => fs.existsSync('apps/backend/src/modules/activity/activity.service.ts') },
  { id: 'p19-backend-tests', check: () => {
    const required = [
      'apps/backend/tests/auth.test.ts',
      'apps/backend/tests/leads.test.ts',
      'apps/backend/tests/media.test.ts',
      'apps/backend/tests/email.test.ts',
      'apps/backend/tests/jobs.test.ts',
      'apps/backend/tests/sheets.test.ts',
      'apps/backend/tests/listings.repository.test.ts',
    ];
    if (!required.every((f) => fs.existsSync(f))) return false;
    const auth = fs.readFileSync('apps/backend/tests/auth.test.ts', 'utf8');
    const leads = fs.readFileSync('apps/backend/tests/leads.test.ts', 'utf8');
    const media = fs.readFileSync('apps/backend/tests/media.test.ts', 'utf8');
    return auth.includes('allows admin to create user')
      && auth.includes('rejects agent creating user')
      && leads.includes('assigns lead and archives')
      && leads.includes('assign_demande_client')
      && media.includes('allows admin to approve')
      && media.includes('rejects agent approving');
  }},
  { id: 'p20-local-runbook', check: () => fs.existsSync('docs/local-development.md') && fs.existsSync('scripts/smoke-local.sh') && fs.existsSync('scripts/smoke-api.mjs') },
  { id: 'p21-vercel-deploy', check: () => fs.existsSync('vercel.json') && fs.existsSync('scripts/deploy-vercel.sh') && fs.existsSync('scripts/verify-deploy-ready.mjs') },
  { id: 'p22-vps-deploy', check: () => fs.existsSync('ecosystem.config.cjs') && fs.existsSync('scripts/deploy-vps.sh') && fs.existsSync('deploy/Caddyfile') },
  { id: 'p23-dns', check: () => fs.existsSync('docs/dns.md') && fs.existsSync('scripts/verify-dns.mjs') },
  { id: 'p24-security-checklist', check: () => fs.existsSync('docs/security-checklist.md') && fs.existsSync('scripts/run-security-checklist.mjs') },
  { id: 'p25-cutover-legacy', check: () => fs.existsSync('scripts/apply-cutover.mjs') && fs.existsSync('scripts/verify-cutover.mjs') && fs.existsSync('supabase/migrations/0006_lockdown_legacy_policies.sql') },
];

process.chdir(root);
let failed = 0;
for (const phase of phases) {
  const ok = phase.check();
  if (ok) console.log(`✓ ${phase.id}`);
  else {
    console.error(`✗ ${phase.id}`);
    failed++;
  }
}

console.log('\nRunning build + tests + ops phases…');
try {
  execSync('npm run build', { stdio: 'inherit', cwd: root });
  execSync('npm run test', { stdio: 'inherit', cwd: root });
  execSync('node scripts/apply-ops-phases.mjs --offline-only', { stdio: 'inherit', cwd: root });
} catch {
  failed++;
}

if (failed) {
  console.error(`\n${failed} phase(s) or checks failed`);
  process.exit(1);
}
console.log(`\n✓ All ${phases.length} plan phases verified in repo`);
