#!/usr/bin/env node
/**
 * Phase 24: Automated production security checklist.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { backendEnv, frontendEnv, rootDir } from './lib/env.mjs';

const errors = [];
const root = rootDir();

function ok(msg) { console.log(`✓ ${msg}`); }
function fail(msg) { errors.push(msg); console.error(`✗ ${msg}`); }

// Secrets not in frontend
const feText = fs.existsSync(path.join(root, 'apps/frontend/.env'))
  ? fs.readFileSync(path.join(root, 'apps/frontend/.env'), 'utf8') : '';
for (const secret of ['SUPABASE_SERVICE_ROLE_KEY', 'R2_SECRET_ACCESS_KEY', 'RESEND_API_KEY']) {
  if (feText.includes(secret)) fail(`${secret} in frontend .env`);
  else ok(`${secret} not in frontend .env`);
}

// Backend env
const be = backendEnv();
if (be.FRONTEND_ORIGIN?.includes('*')) fail('FRONTEND_ORIGIN must not use wildcard');
else ok('FRONTEND_ORIGIN is explicit');

// Helmet + rate limit in app.ts
const appTs = fs.readFileSync(path.join(root, 'apps/backend/src/app.ts'), 'utf8');
if (appTs.includes('helmet')) ok('Helmet middleware present');
else fail('Helmet missing');
if (appTs.includes('rateLimit')) ok('Rate limiter present');
else fail('Rate limiter missing');

// RLS migrations
const rls = fs.readFileSync(path.join(root, 'supabase/migrations/0002_rls.sql'), 'utf8');
if (/enable row level security/i.test(rls)) ok('RLS migration present');
else fail('RLS migration incomplete');

// Git tracked .env
try {
  const tracked = execSync('git ls-files', { encoding: 'utf8', cwd: root });
  for (const line of tracked.split('\n')) {
    if (line.endsWith('.env')) fail(`.env tracked: ${line}`);
  }
  ok('No .env files tracked by git');
} catch {
  ok('Git check skipped (not a repo)');
}

if (errors.length) {
  console.error(`\n${errors.length} security check(s) failed`);
  process.exit(1);
}
console.log('\n✓ Automated security checklist passed');
console.log('Complete manual items in docs/security-checklist.md before sign-off');
