#!/usr/bin/env node
/**
 * Phase 11: Verify R2 bucket connectivity.
 */
import { S3Client, HeadBucketCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { backendEnv } from './lib/env.mjs';

const env = { ...backendEnv(), ...process.env };
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = env;

if ([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET].some((v) => !v || String(v).includes('your-'))) {
  console.error('Configure R2_* vars in apps/backend/.env. See docs/r2-setup.md and deploy/r2-cors.json');
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

await client.send(new HeadBucketCommand({ Bucket: R2_BUCKET }));
console.log(`✓ Bucket "${R2_BUCKET}" reachable`);

const testKey = `_verify/${Date.now()}.txt`;
await client.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: testKey, Body: 'ok' }));
await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: testKey }));
console.log('✓ Put/delete test object succeeded');
console.log('Apply CORS: npm run configure-r2-cors');
