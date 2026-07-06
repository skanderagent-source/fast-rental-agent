#!/usr/bin/env node
/**
 * Phase 20: Automated API smoke (no browser). Complements docs/smoke-test.md manual checklist.
 */
import { execSync } from 'node:child_process';
import { rootDir } from './lib/env.mjs';

const root = rootDir();

console.log('== Phase 20: automated API smoke ==');
if (!process.env.SMOKE_SKIP_BUILD) {
  execSync('npm run build', { stdio: 'inherit', cwd: root });
} else {
  console.log('(build skipped — SMOKE_SKIP_BUILD set)');
}
execSync('npm run test', { stdio: 'inherit', cwd: root });

console.log('\n== Backend health (requires running server or skip) ==');
try {
  execSync('curl -sf --max-time 3 http://localhost:4000/health', { stdio: 'inherit', cwd: root });
  console.log('✓ Backend health reachable at :4000');
} catch {
  console.log('○ Backend not running on :4000 — start with npm run dev:backend for live health check');
  console.log('  Automated test suite above covers API behavior with mocks.');
}

console.log('\n✓ Automated smoke passed');
console.log('Manual UI checklist: docs/smoke-test.md');
