import type { NextFunction, Request, Response } from 'express';

const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function inputError(res: Response, code: string, message: string) {
  return res.status(400).json({ error: { code, message } });
}

/** Reject repeated query keys instead of allowing parser-dependent arrays. */
export function rejectDuplicateQueryParameters(req: Request, res: Response, next: NextFunction) {
  const queryIndex = req.originalUrl.indexOf('?');
  if (queryIndex === -1) return next();

  const params = new URLSearchParams(req.originalUrl.slice(queryIndex + 1));
  const seen = new Set<string>();
  for (const key of params.keys()) {
    if (seen.has(key)) {
      return inputError(res, 'DUPLICATE_QUERY_PARAMETER', `Paramètre dupliqué: ${key}`);
    }
    seen.add(key);
  }
  return next();
}

function containsDangerousKey(value: unknown, seen = new WeakSet<object>()): boolean {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  for (const key of Object.keys(value)) {
    if (DANGEROUS_OBJECT_KEYS.has(key)) return true;
    if (containsDangerousKey((value as Record<string, unknown>)[key], seen)) return true;
  }
  return false;
}

/** Block prototype-mutating keys before DTO validation or object construction. */
export function rejectPrototypePollution(req: Request, res: Response, next: NextFunction) {
  if (containsDangerousKey(req.body) || containsDangerousKey(req.query)) {
    return inputError(
      res,
      'DANGEROUS_OBJECT_KEY',
      'La requête contient une clé d’objet interdite',
    );
  }
  return next();
}
