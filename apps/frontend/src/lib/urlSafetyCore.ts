const BLOCKED_SCHEMES = new Set(['javascript:', 'vbscript:', 'file:']);

export type UrlSafetyContext = {
  production: boolean;
  apiOrigin: string;
};

function parseUrl(value: string, baseOrigin?: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
      return new URL(trimmed);
    }
    if (baseOrigin) return new URL(trimmed, baseOrigin);
    return null;
  } catch {
    return null;
  }
}

function hasBlockedScheme(value: string): boolean {
  const scheme = value.trim().toLowerCase().split(':')[0] + ':';
  return BLOCKED_SCHEMES.has(scheme);
}

function isLocalHttp(url: URL): boolean {
  return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
}

function isHttpsOrLocalHttp(url: URL, production: boolean): boolean {
  return url.protocol === 'https:' || (!production && isLocalHttp(url));
}

function isAllowedMediaHost(hostname: string, production: boolean): boolean {
  return (
    hostname.endsWith('.r2.cloudflarestorage.com')
    || hostname === 'tile.openstreetmap.org'
    || (!production && (hostname === 'localhost' || hostname === '127.0.0.1'))
  );
}

export function isSafeHttpUrl(
  value: string | null | undefined,
  ctx: UrlSafetyContext,
  baseOrigin?: string,
): boolean {
  if (!value || hasBlockedScheme(value)) return false;
  const url = parseUrl(value, baseOrigin);
  if (!url) return false;
  if (url.protocol === 'data:') return false;
  return isHttpsOrLocalHttp(url, ctx.production);
}

export function isSafeMediaUrl(
  value: string | null | undefined,
  ctx: UrlSafetyContext,
): boolean {
  if (!value || hasBlockedScheme(value)) return false;
  const url = parseUrl(value);
  if (!url) return false;
  if (url.protocol === 'data:' || url.protocol === 'blob:') return false;
  if (!isHttpsOrLocalHttp(url, ctx.production)) return false;

  if (url.origin === ctx.apiOrigin) {
    return url.pathname.startsWith('/api/storage/') || url.pathname.startsWith('/api/listings/');
  }

  return isAllowedMediaHost(url.hostname, ctx.production);
}

export function isSafeExternalUrl(
  value: string | null | undefined,
  ctx: UrlSafetyContext,
): boolean {
  if (!isSafeHttpUrl(value, ctx)) return false;
  const url = parseUrl(value!);
  if (!url) return false;

  if (url.origin === ctx.apiOrigin) {
    return url.pathname.startsWith('/api/storage/') || url.pathname.startsWith('/api/listings/media/');
  }

  return url.hostname.endsWith('.r2.cloudflarestorage.com');
}

export function safeMediaSrc(
  value: string | null | undefined,
  ctx: UrlSafetyContext,
): string | undefined {
  return isSafeMediaUrl(value, ctx) ? value!.trim() : undefined;
}

export function isSafeInternalPath(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return false;
  return !trimmed.includes('\\');
}
