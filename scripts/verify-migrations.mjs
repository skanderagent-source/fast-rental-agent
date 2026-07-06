#!/usr/bin/env node
/**
 * Phase 8: Verify core schema objects exist via service role.
 */
import { createClient } from '@supabase/supabase-js';
import { backendEnv } from './lib/env.mjs';

const env = { ...backendEnv(), ...process.env };
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key || key.includes('your-')) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const checks = [
  { table: 'listing_media', label: 'listing_media' },
  { table: 'rentals', label: 'rentals' },
  { table: 'sheet_sync_runs', label: 'sheet_sync_runs' },
  { table: 'app_settings', label: 'app_settings' },
  { table: 'geocode_cache', label: 'geocode_cache' },
];

let failed = 0;
for (const { table, label } of checks) {
  const { error } = await db.from(table).select('*', { head: true, count: 'exact' });
  if (error) {
    console.error(`✗ ${label}: ${error.message}`);
    failed++;
  } else {
    console.log(`✓ ${label}`);
  }
}

const { error: viewErr } = await db.from('listing_media_counts').select('*', { head: true, count: 'exact' });
if (viewErr) {
  console.error(`✗ listing_media_counts view: ${viewErr.message}`);
  failed++;
} else {
  console.log('✓ listing_media_counts view');
}

if (failed) {
  console.error(`\n${failed} check(s) failed. Run: npm run db:push`);
  process.exit(1);
}
console.log('✓ Migration verification passed');
