#!/usr/bin/env node
/**
 * Phase 25: Verify cutover state (legacy moved, optional anon lockdown test).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { backendEnv, rootDir } from './lib/env.mjs';

const root = rootDir();
let failed = 0;

if (fs.existsSync(path.join(root, 'legacy/index.html'))) {
  console.log('✓ legacy/index.html present');
} else {
  console.error('✗ missing legacy/index.html');
  failed++;
}

if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.log('✓ root index.html removed (cutover)');
} else {
  console.error('✗ root index.html still exists — remove at cutover');
  failed++;
}

if (fs.existsSync(path.join(root, 'supabase/migrations/0006_lockdown_legacy_policies.sql'))) {
  console.log('✓ 0006 cutover migration present');
} else {
  console.error('✗ missing 0006 migration');
  failed++;
}

const env = { ...backendEnv(), ...process.env };
if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY && !env.SUPABASE_ANON_KEY.includes('your-')) {
  const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  const { error } = await anon.from('logements').insert({ adresse: 'cutover-test-should-fail' }).select().single();
  if (error) {
    console.log('✓ Anon insert to logements blocked (0006 applied):', error.message.slice(0, 80));
  } else {
    console.warn('⚠ Anon insert succeeded — apply 0006 with npm run cutover when both apps are live');
  }
}

if (failed) process.exit(1);
console.log('✓ Cutover verification passed (repo state)');
