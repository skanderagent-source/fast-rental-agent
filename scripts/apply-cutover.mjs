#!/usr/bin/env node
/**
 * Applies cutover migration 0006 and verifies legacy anon policies are locked down.
 * Requires SUPABASE_DB_URL or linked supabase project.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migration = path.join(root, 'supabase/migrations/0006_lockdown_legacy_policies.sql');

if (!fs.existsSync(migration)) {
  console.error('Missing 0006 migration file.');
  process.exit(1);
}

console.log('Applying cutover migration 0006…');
try {
  execSync('npx supabase db push', { stdio: 'inherit', cwd: root });
} catch {
  console.error('db push failed. Run manually: npx supabase link && npx supabase db push');
  process.exit(1);
}

console.log('Cutover SQL applied. Next steps:');
console.log('1. Verify anon INSERT on logements fails in Supabase SQL editor');
console.log('2. Delete legacy Edge Functions in Supabase dashboard');
console.log('3. Redirect old public site URL to Union Rental');
console.log('4. Confirm root index.html removed (legacy copy at legacy/index.html)');
