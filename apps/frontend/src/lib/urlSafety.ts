import { env } from './env';
import {
  isSafeExternalUrl as isSafeExternalUrlCore,
  isSafeHttpUrl as isSafeHttpUrlCore,
  isSafeMediaUrl as isSafeMediaUrlCore,
  isSafeInternalPath,
  safeMediaSrc as safeMediaSrcCore,
  type UrlSafetyContext,
} from './urlSafetyCore';

const ctx: UrlSafetyContext = {
  production: import.meta.env.PROD,
  apiOrigin: new URL(env.VITE_API_BASE_URL).origin,
};

export { isSafeInternalPath };

export function isSafeHttpUrl(value: string | null | undefined): boolean {
  return isSafeHttpUrlCore(value, ctx, typeof window !== 'undefined' ? window.location.origin : undefined);
}

export function isSafeMediaUrl(value: string | null | undefined): boolean {
  return isSafeMediaUrlCore(value, ctx);
}

export function isSafeExternalUrl(value: string | null | undefined): boolean {
  return isSafeExternalUrlCore(value, ctx);
}

export function safeMediaSrc(value: string | null | undefined): string | undefined {
  return safeMediaSrcCore(value, ctx);
}

export function openUrlSafely(value: string | null | undefined): boolean {
  if (!isSafeExternalUrl(value)) return false;
  const opened = window.open(value!.trim(), '_blank', 'noopener,noreferrer');
  return opened !== null;
}
