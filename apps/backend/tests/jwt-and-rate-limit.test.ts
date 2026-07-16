import { describe, expect, it } from 'vitest';
import { hasDisallowedJwtHeader } from '../src/utils/jwtValidation.js';
import { attachRetryAfterHeader } from '../src/utils/rateLimitResponse.js';

function jwtWithHeader(header: object, payload: object = { sub: 'user-1' }) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode(header)}.${encode(payload)}.signature`;
}

describe('jwtValidation', () => {
  it('allows Supabase HS256, RS256, and ES256 headers', () => {
    expect(hasDisallowedJwtHeader(jwtWithHeader({ alg: 'HS256', typ: 'JWT' }))).toBe(false);
    expect(hasDisallowedJwtHeader(jwtWithHeader({ alg: 'RS256', typ: 'JWT' }))).toBe(false);
    expect(hasDisallowedJwtHeader(jwtWithHeader({ alg: 'ES256', typ: 'JWT' }))).toBe(false);
  });

  it('rejects unsigned and unknown algorithms', () => {
    expect(hasDisallowedJwtHeader(jwtWithHeader({ alg: 'none', typ: 'JWT' }))).toBe(true);
    expect(hasDisallowedJwtHeader(jwtWithHeader({ alg: 'HS384', typ: 'JWT' }))).toBe(true);
    expect(hasDisallowedJwtHeader(jwtWithHeader({ alg: 'PS256', typ: 'JWT' }))).toBe(true);
  });

  it('rejects non-JWT typ values', () => {
    expect(hasDisallowedJwtHeader(jwtWithHeader({ alg: 'HS256', typ: 'JOSE' }))).toBe(true);
  });

  it('does not block opaque integration tokens', () => {
    expect(hasDisallowedJwtHeader('fake-token')).toBe(false);
  });
});

describe('rateLimitResponse', () => {
  it('sets Retry-After from the rate-limit reset time', () => {
    const headers: Record<string, string> = {};
    const req = {
      rateLimit: {
        resetTime: new Date(Date.now() + 42_000),
      },
    };
    const res = {
      setHeader(name: string, value: string) {
        headers[name] = value;
      },
    };

    attachRetryAfterHeader(req as never, res as never);

    expect(headers['Retry-After']).toBe('42');
  });

  it('omits Retry-After when reset time is unavailable', () => {
    const headers: Record<string, string> = {};
    const res = {
      setHeader(name: string, value: string) {
        headers[name] = value;
      },
    };

    attachRetryAfterHeader({} as never, res as never);

    expect(headers['Retry-After']).toBeUndefined();
  });
});
