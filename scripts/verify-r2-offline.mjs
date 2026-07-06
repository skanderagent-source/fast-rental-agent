#!/usr/bin/env node
/**
 * Phase 11 (offline): Verify R2 integration artifacts and CORS policy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from './lib/env.mjs';

const root = rootDir();
let failed = 0;

const corsPath = path.join(root, 'deploy/r2-cors.json');
if (!fs.existsSync(corsPath)) {
  console.error('✗ missing deploy/r2-cors.json');
  process.exit(1);
}

const cors = JSON.parse(fs.readFileSync(corsPath, 'utf8'));
const policy = cors[0];
if (!policy?.AllowedOrigins?.includes('http://localhost:5173')) {
  console.error('✗ R2 CORS must allow http://localhost:5173');
  failed++;
}
for (const method of ['PUT', 'GET', 'HEAD']) {
  if (!policy.AllowedMethods.includes(method)) {
    console.error(`✗ R2 CORS missing method ${method}`);
    failed++;
  }
}
console.log('✓ deploy/r2-cors.json');

const r2Service = fs.readFileSync(path.join(root, 'apps/backend/src/modules/media/r2.service.ts'), 'utf8');
for (const snippet of ['S3Client', 'createUploadUrl', 'createDownloadUrl', 'r2.cloudflarestorage.com']) {
  if (!r2Service.includes(snippet)) {
    console.error(`✗ r2.service.ts missing ${snippet}`);
    failed++;
  } else {
    console.log(`✓ r2.service.ts has ${snippet}`);
  }
}

if (!fs.existsSync(path.join(root, 'scripts/verify-r2.mjs'))) {
  console.error('✗ missing scripts/verify-r2.mjs');
  failed++;
} else {
  console.log('✓ scripts/verify-r2.mjs');
}

if (failed) process.exit(1);
console.log('✓ Offline R2 verification passed');
