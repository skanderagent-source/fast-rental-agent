#!/usr/bin/env node
/**
 * Phase 4: Backup remote database before migrations.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from './lib/env.mjs';

const outDir = path.join(rootDir(), 'backups');
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `backup-${new Date().toISOString().slice(0, 10)}.sql`);

console.log(`Writing backup to ${file}…`);
execSync(`npx supabase db dump -f "${file}"`, { stdio: 'inherit', cwd: rootDir() });
console.log('✓ Backup complete');
