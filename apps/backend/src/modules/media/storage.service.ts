import { createReadStream } from 'node:fs';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../config/env.js';
import * as r2 from './r2.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_ROOT = path.resolve(__dirname, '../../../.local-storage');

function useLocalStorage() {
  return env.STORAGE_DRIVER === 'local';
}

function localPath(objectKey: string) {
  const safe = objectKey.replace(/\.\./g, '');
  return path.join(LOCAL_ROOT, safe);
}

export async function putObject(objectKey: string, body: Buffer, mimeType: string) {
  if (useLocalStorage()) {
    const target = localPath(objectKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    return;
  }
  await r2.putObject(objectKey, body, mimeType);
}

export async function objectExists(objectKey: string) {
  if (useLocalStorage()) {
    try {
      await access(localPath(objectKey));
      return true;
    } catch {
      return false;
    }
  }
  return r2.objectExists(objectKey);
}

export async function deleteObject(objectKey: string) {
  if (useLocalStorage()) {
    try {
      await rm(localPath(objectKey), { force: true });
    } catch {
      /* ignore missing file */
    }
    return;
  }
  await r2.deleteObject(objectKey);
}

export async function createUploadUrl(objectKey: string, mimeType: string) {
  if (useLocalStorage()) {
    return `${env.PUBLIC_API_BASE_URL}/api/storage/upload-placeholder?key=${encodeURIComponent(objectKey)}`;
  }
  return r2.createUploadUrl(objectKey, mimeType);
}

export async function createDownloadUrl(objectKey: string, filename: string, inline = false) {
  if (useLocalStorage()) {
    const params = new URLSearchParams({ key: objectKey, inline: inline ? '1' : '0', name: filename });
    return `${env.PUBLIC_API_BASE_URL}/api/storage/object?${params.toString()}`;
  }
  return r2.createDownloadUrl(objectKey, filename, inline);
}

export function openLocalObject(objectKey: string) {
  return createReadStream(localPath(objectKey));
}

export function isLocalStorage() {
  return useLocalStorage();
}
