import { env } from '../config/env.js';
import { assertPublicOutboundHostname } from './outboundHostname.js';

export { assertPublicOutboundHostname } from './outboundHostname.js';

export function assertAllowlistedOutboundUrl(url: URL, allowedOrigin: string): void {
  if (url.origin !== allowedOrigin) {
    throw new Error(`Outbound origin not allowlisted: ${url.origin}`);
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && env.NODE_ENV !== 'production')) {
    throw new Error(`Outbound protocol blocked: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new Error('Outbound URL credentials are not allowed');
  }
  assertPublicOutboundHostname(url.hostname);
}

export async function fetchAllowlisted(
  url: URL,
  allowedOrigin: string,
  init: RequestInit = {},
): Promise<Response> {
  assertAllowlistedOutboundUrl(url, allowedOrigin);

  const response = await fetch(url, {
    ...init,
    redirect: 'manual',
    signal: init.signal ?? AbortSignal.timeout(env.GEOCODING_FETCH_TIMEOUT_MS),
  });

  if (response.status >= 300 && response.status < 400) {
    throw new Error(`Outbound redirect blocked (${response.status})`);
  }

  return response;
}

export function geocodingAllowedOrigin(): string {
  const url = new URL(env.GEOCODING_BASE_URL);
  assertPublicOutboundHostname(url.hostname);
  if (env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('GEOCODING_BASE_URL must use HTTPS in production');
  }
  return url.origin;
}
