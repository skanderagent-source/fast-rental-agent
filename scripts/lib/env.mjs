import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function rootDir() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
}

export function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const map = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    map[trimmed.slice(0, idx)] = trimmed.slice(idx + 1).replace(/^"|"$/g, '');
  }
  return map;
}

export function backendEnv() {
  return loadEnvFile(path.join(rootDir(), 'apps/backend/.env'));
}

export function frontendEnv() {
  return loadEnvFile(path.join(rootDir(), 'apps/frontend/.env'));
}
