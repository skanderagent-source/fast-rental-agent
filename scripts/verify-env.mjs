import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const errors = [];

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, 'utf8');
  const map = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    map[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return map;
}

if (!fs.existsSync(path.join(root, 'package.json'))) {
  errors.push('Root package.json is missing.');
}

const backendEnv = readEnv(path.join(root, 'apps/backend/.env'));
const frontendEnv = readEnv(path.join(root, 'apps/frontend/.env'));

const backendRequired = [
  'NODE_ENV', 'PORT', 'PUBLIC_API_BASE_URL', 'FRONTEND_ORIGIN',
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET',
  'R2_SIGNED_UPLOAD_EXPIRES_SECONDS', 'R2_SIGNED_DOWNLOAD_EXPIRES_SECONDS',
  'GOOGLE_SHEET_FAST_RENTAL_ID',
  // 'GOOGLE_SHEET_ORCHA_ID', 'GOOGLE_SHEET_ORCHA_GID',
  'EMAIL_ENABLED', 'GEOCODING_USER_AGENT', 'GEOCODING_BASE_URL',
  'CRON_SHEET_SYNC', 'CRON_ARCHIVE_DELETE', 'CRON_STALE_MEDIA_CLEANUP',
  'RATE_LIMIT_PUBLIC_WINDOW_MS', 'RATE_LIMIT_PUBLIC_MAX',
];

const frontendRequired = [
  'VITE_API_BASE_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_PUBLIC_SITE_URL',
];

if (!backendEnv) {
  errors.push('apps/backend/.env is missing. Copy from apps/backend/.env.example');
} else {
  for (const key of backendRequired) {
    if (!backendEnv[key]) errors.push(`apps/backend/.env missing ${key}`);
  }
}

if (!frontendEnv) {
  errors.push('apps/frontend/.env is missing. Copy from apps/frontend/.env.example');
} else {
  for (const key of frontendRequired) {
    if (!frontendEnv[key]) errors.push(`apps/frontend/.env missing ${key}`);
  }
}

if (frontendEnv) {
  const frontendText = fs.readFileSync(path.join(root, 'apps/frontend/.env'), 'utf8');
  for (const secret of ['SUPABASE_SERVICE_ROLE_KEY', 'R2_SECRET_ACCESS_KEY', 'RESEND_API_KEY']) {
    if (frontendText.includes(secret)) {
      errors.push(`${secret} must not appear in apps/frontend/.env`);
    }
  }
}

function isTrackedSecretEnv(filePath) {
  const name = path.basename(filePath);
  if (name.endsWith('.example')) return false;
  return name === '.env' || name.startsWith('.env.');
}

try {
  const tracked = execSync('git ls-files', { encoding: 'utf8' });
  for (const line of tracked.split('\n')) {
    if (line && isTrackedSecretEnv(line)) {
      errors.push(`.env file is tracked by git: ${line}`);
    }
  }
} catch {
  // Not a git repo yet — skip
}

if (errors.length) {
  console.error('Environment check failed:\n' + errors.map((e) => `- ${e}`).join('\n'));
  process.exit(1);
}

console.log('Environment check passed.');
