import { createReadStream } from 'node:fs';
import { access, mkdir, open, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../config/env.js';
import { assertSafeObjectKey } from '../../utils/objectKey.js';
import * as r2 from './r2.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_ROOT = path.resolve(__dirname, '../../../.local-storage');

function useLocalStorage() {
  return env.STORAGE_DRIVER === 'local';
}

function localPath(objectKey: string) {
  assertSafeObjectKey(objectKey);
  const resolved = path.resolve(LOCAL_ROOT, objectKey);
  const rootWithSep = `${LOCAL_ROOT}${path.sep}`;
  if (resolved !== LOCAL_ROOT && !resolved.startsWith(rootWithSep)) {
    throw Object.assign(new Error('Clé objet invalide'), { status: 400, code: 'VALIDATION_ERROR' });
  }
  return resolved;
}

export async function putObject(objectKey: string, body: Buffer, mimeType: string) {
  assertSafeObjectKey(objectKey);
  if (useLocalStorage()) {
    const target = localPath(objectKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    return;
  }
  await r2.putObject(objectKey, body, mimeType);
}

export async function objectExists(objectKey: string) {
  assertSafeObjectKey(objectKey);
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
  assertSafeObjectKey(objectKey);
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

const CONTENT_INSPECTION_BYTES = 256 * 1024;

export async function readObjectSize(objectKey: string): Promise<number> {
  assertSafeObjectKey(objectKey);
  if (useLocalStorage()) {
    const handle = await open(localPath(objectKey), 'r');
    try {
      const stats = await handle.stat();
      return stats.size;
    } finally {
      await handle.close();
    }
  }
  return r2.getObjectSize(objectKey);
}

export async function readObjectPrefix(objectKey: string, maxBytes = CONTENT_INSPECTION_BYTES): Promise<Buffer> {
  assertSafeObjectKey(objectKey);
  if (useLocalStorage()) {
    const filePath = localPath(objectKey);
    const handle = await open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(maxBytes);
      const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }
  return r2.readObjectPrefix(objectKey, maxBytes);
}

export async function readObjectBytes(objectKey: string): Promise<Buffer> {
  assertSafeObjectKey(objectKey);
  if (useLocalStorage()) {
    return readFile(localPath(objectKey));
  }
  return r2.readObjectBytes(objectKey);
}

export function isLocalStorage() {
  return useLocalStorage();
}
