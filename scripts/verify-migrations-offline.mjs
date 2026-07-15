#!/usr/bin/env node
/**
 * Phase 8 (offline): Verify migration files match plan intent without a live DB.
 */
import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from './lib/env.mjs';

const root = rootDir();
const dir = path.join(root, 'supabase/migrations');
const expected = [
  '0001_init.sql',
  '0002_rls.sql',
  '0003_functions_and_triggers.sql',
  '0004_seed_admin.sql',
  '0005_backfill_assigned_leads.sql',
  '0006_lockdown_legacy_policies.sql',
  '0007_sheet_import_columns.sql',
];

const requiredSnippets = {
  '0001_init.sql': ['listing_media', 'reserve_listing_media_upload', 'listing_media_counts'],
  '0002_rls.sql': ['enable row level security', 'is_admin()'],
  '0003_functions_and_triggers.sql': ['archive_assigned_lead', 'traitement_statut'],
  '0004_seed_admin.sql': ['app_settings'],
  '0005_backfill_assigned_leads.sql': ['delete_after'],
  '0006_lockdown_legacy_policies.sql': ['logements'],
  '0007_sheet_import_columns.sql': ['locataire_nom', 'locataire_tel'],
  '0018_assign_demande_client_rpc.sql': ['assign_demande_client'],
  '0021_fix_protect_demande_fields.sql': ['protect_demande_fields', 'fast_rental.allow_demande_assign'],
  '0022_tighten_demande_assignment_guards.sql': ['protect_agent_role', 'fast_rental.allow_demande_assign'],
};

const requiredFiles = [
  ...expected,
  '0018_assign_demande_client_rpc.sql',
  '0021_fix_protect_demande_fields.sql',
  '0022_tighten_demande_assignment_guards.sql',
];

let failed = 0;
for (const file of requiredFiles) {
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) {
    console.error(`✗ missing ${file}`);
    failed++;
    continue;
  }
  const sql = fs.readFileSync(full, 'utf8');
  for (const snippet of requiredSnippets[file] ?? []) {
    if (!sql.toLowerCase().includes(snippet.toLowerCase())) {
      console.error(`✗ ${file} missing "${snippet}"`);
      failed++;
    }
  }
  if (fs.existsSync(full)) console.log(`✓ ${file}`);
}

if (failed) process.exit(1);
console.log('✓ Offline migration verification passed');
