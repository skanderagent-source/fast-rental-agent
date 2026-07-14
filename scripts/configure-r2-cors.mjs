#!/usr/bin/env node
/**
 * Applies CORS rules from deploy/r2-cors.json to the R2 bucket (required for browser uploads).
 */
import fs from 'node:fs';
import path from 'node:path';
import { PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3';
import { backendEnv, rootDir } from './lib/env.mjs';

const env = { ...backendEnv(), ...process.env };
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = env;

if ([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET].some((v) => !v || String(v).includes('your-'))) {
  console.error('Configure R2_* vars in apps/backend/.env');
  process.exit(1);
}

const corsPath = path.join(rootDir(), 'deploy/r2-cors.json');
if (!fs.existsSync(corsPath)) {
  console.error('Missing deploy/r2-cors.json');
  process.exit(1);
}

const rules = JSON.parse(fs.readFileSync(corsPath, 'utf8'));
if (!Array.isArray(rules) || rules.length === 0) {
  console.error('deploy/r2-cors.json must be a non-empty array');
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

await client.send(new PutBucketCorsCommand({
  Bucket: R2_BUCKET,
  CORSConfiguration: { CORSRules: rules },
}));

console.log(`✓ CORS applied to bucket "${R2_BUCKET}"`);
console.log('  Allowed origins:', rules[0]?.AllowedOrigins?.join(', ') ?? '(see deploy/r2-cors.json)');
