#!/usr/bin/env node
/**
 * Applies plan phases 42–46 (p4, p8, p11, p20, p21–p25):
 * - Offline verification always (theory + repo intent)
 * - Live verification when credentials are configured
 *
 * Usage: npm run apply-ops [-- --live-only] [-- --offline-only]
 */
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { credentialStatus, hasLiveR2, hasLiveSupabase } from './lib/credentials.mjs';
import { rootDir } from './lib/env.mjs';

const root = rootDir();
const args = process.argv.slice(2);
const offlineOnly = args.includes('--offline-only');
const liveOnly = args.includes('--live-only');

/** @type {Record<string, { offline: boolean; live: boolean | null; note?: string }>} */
const status = {};

function runNode(script, label, extraEnv = {}) {
  const res = spawnSync('node', [script], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, ...extraEnv },
  });
  if (res.status === 0) {
    console.log(res.stdout.trim());
    return true;
  }
  console.error(res.stderr || res.stdout);
  return false;
}

function runNpm(script, label) {
  try {
    execSync(`npm run ${script}`, { stdio: 'inherit', cwd: root });
    return true;
  } catch {
    return false;
  }
}

function phase(id, { offline, live, note }) {
  status[id] = { offline, live, note };
}

console.log('=== Apply ops phases (41→46 gap) ===\n');
const creds = credentialStatus();
console.log('Credential readiness:');
console.log(`  Supabase live: ${hasLiveSupabase(creds) ? 'yes' : 'no (placeholders in .env)'}`);
console.log(`  R2 live:       ${hasLiveR2(creds) ? 'yes' : 'no (placeholders in .env)'}`);
console.log(`  DNS domains:   ${creds.dns.apiDomain || creds.dns.frontendDomain ? 'set' : 'not set (offline OK)'}\n`);

// p4 Supabase auth
if (!liveOnly) {
  console.log('--- p4 Supabase auth (offline) ---');
  phase('p4', { offline: runNode('scripts/verify-supabase-auth-offline.mjs', 'p4-offline'), live: null });
}
if (!offlineOnly && hasLiveSupabase(creds)) {
  console.log('--- p4 Supabase auth (live) ---');
  phase('p4', { ...status.p4, live: runNpm('verify-supabase-auth', 'p4-live') });
} else if (!offlineOnly) {
  phase('p4', { ...status.p4, live: null, note: 'Fill SUPABASE_* keys in apps/backend/.env then re-run' });
  console.log('○ p4 live skipped — configure Supabase keys');
}

// p8 migrations
if (!liveOnly) {
  console.log('\n--- p8 migrations (offline) ---');
  phase('p8', { offline: runNode('scripts/verify-migrations-offline.mjs', 'p8-offline'), live: null });
}
if (!offlineOnly && hasLiveSupabase(creds)) {
  console.log('--- p8 migrations (live) ---');
  console.log('Attempting supabase link + db push (requires `npx supabase login`)…');
  const livePush = runNpm('db:push', 'p8-live');
  phase('p8', { ...status.p8, live: livePush });
  if (livePush) runNpm('verify-migrations', 'p8-verify');
} else if (!offlineOnly) {
  phase('p8', { ...status.p8, live: null, note: 'Run: npx supabase login && npm run db:push' });
  console.log('○ p8 live skipped — Supabase credentials or CLI login required');
}

// p11 R2
if (!liveOnly) {
  console.log('\n--- p11 R2 (offline) ---');
  phase('p11', { offline: runNode('scripts/verify-r2-offline.mjs', 'p11-offline'), live: null });
}
if (!offlineOnly && hasLiveR2(creds)) {
  console.log('--- p11 R2 (live) ---');
  phase('p11', { ...status.p11, live: runNpm('verify-r2', 'p11-live') });
} else if (!offlineOnly) {
  phase('p11', { ...status.p11, live: null, note: 'Fill R2_* keys in apps/backend/.env' });
  console.log('○ p11 live skipped — R2 credentials required');
}

// p20 smoke
if (!liveOnly) {
  console.log('\n--- p20 local smoke (automated) ---');
  phase('p20', {
    offline: runNode('scripts/smoke-api.mjs', 'p20-auto', { SMOKE_SKIP_BUILD: '1' }),
    live: null,
  });
}

// p21–p25 deploy/cutover (offline artifacts + security)
if (!liveOnly) {
  console.log('\n--- p21–p25 deploy/cutover (offline) ---');
  const deployOk = runNode('scripts/verify-deploy-ready.mjs', 'deploy-offline');
  const secOk = runNode('scripts/run-security-checklist.mjs', 'security');
  const cutoverOk = runNode('scripts/verify-cutover.mjs', 'cutover-repo');
  phase('p21-p25', {
    offline: deployOk && secOk && cutoverOk,
    live: null,
    note: 'Production deploy/DNS/cutover live steps need domains + VPS/Vercel access',
  });
}

if (!offlineOnly && hasLiveSupabase(creds)) {
  console.log('\n--- p25 cutover (live DB check) ---');
  const cutoverLive = runNpm('verify-cutover', 'p25-live');
  status['p21-p25'] = { ...status['p21-p25'], live: cutoverLive };
}

// Write manifest
const manifest = {
  updatedAt: new Date().toISOString(),
  phases: status,
  credentialHints: {
    supabase: !hasLiveSupabase(creds),
    r2: !hasLiveR2(creds),
    dns: !creds.dns.apiDomain && !creds.dns.frontendDomain,
  },
};

const manifestPath = path.join(root, 'docs/ops-phase-status.json');
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nWrote ${manifestPath}`);

const offlineFailed = Object.values(status).filter((s) => s.offline === false).length;
const livePending = Object.values(status).filter((s) => s.live === null && s.note).length;

console.log('\n=== Summary ===');
for (const [id, s] of Object.entries(status)) {
  console.log(`${id}: offline=${s.offline ? '✓' : '✗'} live=${s.live === true ? '✓' : s.live === false ? '✗' : '○'}${s.note ? ` (${s.note})` : ''}`);
}

if (offlineFailed) {
  console.error(`\n${offlineFailed} offline phase(s) failed`);
  process.exit(1);
}

console.log(`\n✓ All ops phases applied offline (${Object.keys(status).length} groups)`);
if (livePending) {
  console.log(`${livePending} live step(s) pending credentials — see docs/zero-gap-guide.md`);
}
