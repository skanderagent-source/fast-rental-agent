import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'shared/logo');
const publicDir = path.join(root, 'apps/frontend/public');
const icoSrc = path.join(srcDir, 'favicon.ico');
const processor = path.join(root, 'scripts/process-logos.py');

mkdirSync(publicDir, { recursive: true });

if (!existsSync(icoSrc)) {
  throw new Error(`Missing favicon source: ${icoSrc}`);
}

copyFileSync(icoSrc, path.join(publicDir, 'favicon.ico'));
console.log('Copied shared/logo/favicon.ico → apps/frontend/public/favicon.ico');

if (!existsSync(processor)) {
  console.warn('Logo crop script missing; login logo assets were not regenerated.');
  process.exit(0);
}

try {
  execFileSync('python3', [processor], { stdio: 'inherit' });
} catch (error) {
  console.warn('Login logo crop skipped (python3/Pillow unavailable). Favicon is still synced.');
  if (error instanceof Error) {
    console.warn(error.message);
  }
}
