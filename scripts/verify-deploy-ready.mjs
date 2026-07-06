#!/usr/bin/env node
/**
 * Phases 21–25 (offline): Verify deploy/cutover/DNS artifacts match plan intent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from './lib/env.mjs';

const root = rootDir();
let failed = 0;

function need(rel, label) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.error(`✗ ${label}: missing ${rel}`);
    failed++;
    return '';
  }
  console.log(`✓ ${label}`);
  return fs.readFileSync(full, 'utf8');
}

need('vercel.json', 'Vercel config');
need('scripts/deploy-vercel.sh', 'Vercel deploy script');
need('ecosystem.config.cjs', 'PM2 ecosystem');
need('deploy/Caddyfile', 'Caddy reverse proxy');
need('scripts/deploy-vps.sh', 'VPS deploy script');
need('docs/dns.md', 'DNS doc');
need('scripts/verify-dns.mjs', 'DNS verify script');
need('scripts/post-dns-checklist.mjs', 'Post-DNS checklist');
need('docs/security-checklist.md', 'Security checklist');
need('scripts/run-security-checklist.mjs', 'Security automation');
need('scripts/apply-cutover.mjs', 'Cutover apply script');
need('scripts/verify-cutover.mjs', 'Cutover verify script');
need('scripts/create-test-agent.mjs', 'Skander test agent script');

const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
if (!vercel.rewrites?.length) {
  console.error('✗ vercel.json missing SPA rewrites');
  failed++;
}

const pm2 = fs.readFileSync(path.join(root, 'ecosystem.config.cjs'), 'utf8');
if (!pm2.includes('fast-rental-api') || !pm2.includes('dist/server.js')) {
  console.error('✗ ecosystem.config.cjs misconfigured');
  failed++;
}

if (fs.existsSync(path.join(root, 'index.html'))) {
  console.error('✗ root index.html should be removed at cutover');
  failed++;
} else {
  console.log('✓ root index.html removed');
}

if (!fs.existsSync(path.join(root, 'legacy/index.html'))) {
  console.error('✗ legacy/index.html missing');
  failed++;
} else {
  console.log('✓ legacy/index.html preserved');
}

if (failed) process.exit(1);
console.log('✓ Deploy/cutover offline verification passed');
