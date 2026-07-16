#!/usr/bin/env node
/**
 * Phase 4 (offline): Verify auth setup artifacts and app redirect URLs match plan.
 */
import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from './lib/env.mjs';

const root = rootDir();
let failed = 0;

function requireFile(rel, label) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.error(`✗ ${label}: missing ${rel}`);
    failed++;
    return '';
  }
  console.log(`✓ ${label}`);
  return fs.readFileSync(full, 'utf8');
}

requireFile('docs/supabase-auth-setup.md', 'Auth setup doc');
requireFile('scripts/verify-supabase-auth.mjs', 'Live auth verify script');
requireFile('scripts/create-initial-admin.mjs', 'Initial admin script');

const routes = requireFile('apps/frontend/src/app/routes.tsx', 'Frontend routes');
const login = requireFile('apps/frontend/src/features/auth/LoginPage.tsx', 'Login page');
const authProvider = requireFile('apps/frontend/src/app/providers/AuthProvider.tsx', 'AuthProvider');

for (const pathFragment of ['/auth/reset-password', '/auth/force-password-change', '/agent-login']) {
  if (!routes.includes(pathFragment)) {
    console.error(`✗ routes missing ${pathFragment}`);
    failed++;
  }
}

if (routes.includes('/auth/mfa')) {
  console.error('✗ routes still include removed /auth/mfa route');
  failed++;
}

if (!login.includes('expired')) {
  console.error('✗ LoginPage missing session-expired handling');
  failed++;
}

if (!authProvider.includes('expired')) {
  console.error('✗ AuthProvider missing session-expired redirect');
  failed++;
}

const setupDoc = fs.readFileSync(path.join(root, 'docs/supabase-auth-setup.md'), 'utf8');
if (!setupDoc.includes('twkqsaupojldddclgpqj')) {
  console.error('✗ supabase-auth-setup.md missing project ref');
  failed++;
}
for (const requirement of ['900 seconds', 'Require current password']) {
  if (!setupDoc.includes(requirement)) {
    console.error(`✗ Supabase auth setup missing security requirement: ${requirement}`);
    failed++;
  }
}

const authorization = requireFile('apps/backend/src/middleware/requireRole.ts', 'Permission middleware');
if (!authorization.includes('requirePermission')) {
  console.error('✗ Admin permission enforcement missing');
  failed++;
}

if (failed) process.exit(1);
console.log('✓ Offline Supabase auth verification passed');
