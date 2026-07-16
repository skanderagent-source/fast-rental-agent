/** Supabase Auth JWT signing algorithms (symmetric, RSA, and ECDSA signing keys). */
export const ALLOWED_JWT_ALGORITHMS = new Set(['HS256', 'RS256', 'ES256', 'ES384', 'ES512']);

/**
 * Rejects obviously unsafe JWT headers before calling Supabase `getUser()`.
 * Malformed or opaque tokens are left for the provider to reject.
 */
export function hasDisallowedJwtHeader(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as {
      alg?: unknown;
      typ?: unknown;
    };
    if (header.typ && header.typ !== 'JWT') return true;
    if (header.alg === 'none' || header.alg === 'None' || header.alg === 'NONE') return true;
    if (typeof header.alg !== 'string' || !ALLOWED_JWT_ALGORITHMS.has(header.alg)) return true;
    return false;
  } catch {
    return false;
  }
}
