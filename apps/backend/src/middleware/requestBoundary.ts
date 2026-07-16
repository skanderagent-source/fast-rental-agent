import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

const BLOCKED_METHODS = new Set(['TRACE', 'TRACK', 'CONNECT']);
const SENSITIVE_SINGLETON_HEADERS = new Set(['host', 'content-length', 'transfer-encoding']);

function trustedHosts() {
  return new Set([
    new URL(env.PUBLIC_API_BASE_URL).host.toLowerCase(),
    ...(env.TRUSTED_HOSTS ?? '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  ]);
}

function rawHeaderCounts(req: Request) {
  const counts = new Map<string, number>();
  for (let index = 0; index < req.rawHeaders.length; index += 2) {
    const name = req.rawHeaders[index]?.toLowerCase();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

function boundaryError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

/**
 * Reject ambiguous requests before CORS, authentication, or body parsing.
 * Caddy and Node already parse HTTP strictly; these checks make the accepted
 * representation explicit and provide consistent application responses.
 */
export function enforceRequestBoundary(req: Request, res: Response, next: NextFunction) {
  if (BLOCKED_METHODS.has(req.method.toUpperCase())) {
    return boundaryError(res, 405, 'METHOD_NOT_ALLOWED', 'Méthode HTTP non autorisée');
  }

  const counts = rawHeaderCounts(req);
  for (const name of SENSITIVE_SINGLETON_HEADERS) {
    if ((counts.get(name) ?? 0) > 1) {
      return boundaryError(res, 400, 'AMBIGUOUS_REQUEST', `En-tête ${name} dupliqué`);
    }
  }
  if (req.headers['content-length'] && req.headers['transfer-encoding']) {
    return boundaryError(
      res,
      400,
      'AMBIGUOUS_REQUEST',
      'Content-Length et Transfer-Encoding ne peuvent pas être combinés',
    );
  }

  const rawTarget = req.originalUrl;
  const rawPath = rawTarget.split('?')[0] ?? '';
  if (
    /^https?:\/\//i.test(rawTarget)
    || /\\|%2f|%5c|%2e|%00/i.test(rawPath)
    || /(^|\/)\.{1,2}(\/|$)/.test(rawPath)
    || /\/{2,}/.test(rawPath)
  ) {
    return boundaryError(res, 400, 'AMBIGUOUS_PATH', 'Chemin de requête non canonique');
  }

  if (process.env.NODE_ENV === 'production') {
    const host = req.get('host')?.trim().toLowerCase();
    if (!host || !trustedHosts().has(host)) {
      return boundaryError(res, 400, 'INVALID_HOST', 'Hôte HTTP non autorisé');
    }
  }

  return next();
}
