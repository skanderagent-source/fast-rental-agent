#!/usr/bin/env node
/**
 * CI secret scanning for tracked repository files.
 * Complements verify-env (local .env) with git-history-safe pattern checks.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from './lib/env.mjs';

const root = rootDir();
const errors = [];

const SKIP_SUFFIXES = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot',
  '.pdf', '.zip', '.gz',
];
const SKIP_FILES = new Set([
  'package-lock.json',
  'apps/frontend/tsconfig.tsbuildinfo',
]);
const SKIP_PATH_PARTS = [
  '/node_modules/',
  '/dist/',
  '/coverage/',
  '/backups/',
  '/.local-storage/',
];

const RULES = [
  {
    name: 'PEM private key material',
    re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: 'Likely Supabase service-role assignment',
    re: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!your-service-role-key|example|changeme)[A-Za-z0-9._-]{20,}/,
  },
  {
    name: 'Likely R2 secret key assignment',
    re: /R2_SECRET_ACCESS_KEY\s*=\s*(?!your-r2-secret|example|changeme)[A-Za-z0-9+/=_-]{20,}/,
  },
  {
    name: 'Likely Resend API key assignment',
    re: /RESEND_API_KEY\s*=\s*(?!re_test|example|changeme)[A-Za-z0-9._-]{10,}/,
  },
  {
    name: 'Service role key in frontend tree',
    re: /SUPABASE_SERVICE_ROLE_KEY/,
    onlyUnder: 'apps/frontend/',
  },
];

function shouldScan(file) {
  if (SKIP_FILES.has(file)) return false;
  if (file.endsWith('.example') || file.endsWith('.env.example')) return false;
  if (SKIP_SUFFIXES.some((suffix) => file.endsWith(suffix))) return false;
  if (SKIP_PATH_PARTS.some((part) => file.includes(part))) return false;
  return true;
}

function trackedFiles() {
  try {
    return execSync('git ls-files', { encoding: 'utf8', cwd: root })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

for (const relative of trackedFiles()) {
  if (!shouldScan(relative)) continue;
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
  const text = fs.readFileSync(absolute, 'utf8');

  for (const rule of RULES) {
    if (rule.onlyUnder && !relative.startsWith(rule.onlyUnder)) continue;
    if (rule.re.test(text)) {
      errors.push(`${rule.name} matched in ${relative}`);
    }
  }
}

if (errors.length) {
  console.error('Secret scan failed:\n' + errors.map((e) => `- ${e}`).join('\n'));
  process.exit(1);
}

console.log('Secret scan passed.');
