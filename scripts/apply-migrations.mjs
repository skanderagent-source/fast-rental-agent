#!/usr/bin/env node
/**
 * Phase 8: Apply Supabase migrations (dry-run then push).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from './lib/env.mjs';

const root = rootDir();
const migrations = path.join(root, 'supabase/migrations');

if (!fs.existsSync(migrations)) {
  console.error('Missing supabase/migrations');
  process.exit(1);
}

const projectRef = process.env.SUPABASE_PROJECT_REF ?? 'twkqsaupojldddclgpqj';

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', cwd: root });
}

try {
  if (!fs.existsSync(path.join(root, 'supabase/.temp'))) {
    console.log('Linking project…');
    run(`npx supabase link --project-ref ${projectRef}`);
  }
  console.log('Dry run…');
  run('npx supabase db push --dry-run');
  console.log('Applying migrations…');
  run('npx supabase db push --yes');
  console.log('✓ Migrations applied');
} catch (err) {
  console.error('\nFallback: paste SQL files from supabase/migrations/ into Supabase SQL Editor in order.');
  process.exit(1);
}
