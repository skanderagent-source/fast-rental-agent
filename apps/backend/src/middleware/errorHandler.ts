import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { HttpError } from '../utils/httpErrors.js';

const GENERIC_SERVER_ERROR = 'Erreur interne du serveur';
const GENERIC_CLIENT_ERROR = 'Requête invalide';

function resolveStatus(err: unknown): number {
  if (err instanceof HttpError) return err.status;
  if (typeof err === 'object' && err && 'status' in err) {
    return Number((err as { status: number }).status);
  }
  return 500;
}

function resolveCode(err: unknown, status: number): string {
  if (err instanceof HttpError) return err.code;
  if (typeof err === 'object' && err && 'code' in err) {
    return String((err as { code: string }).code);
  }
  return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
}

function resolveClientMessage(err: unknown, status: number): string {
  if (status >= 500) return GENERIC_SERVER_ERROR;
  if (err instanceof HttpError) return err.message;
  if (env.NODE_ENV !== 'production' && err instanceof Error && err.message) return err.message;
  if (status >= 400 && status < 500) return GENERIC_CLIENT_ERROR;
  return GENERIC_SERVER_ERROR;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const status = resolveStatus(err);
  const code = resolveCode(err, status);
  const message = resolveClientMessage(err, status);
  if (status >= 500) {
    logger.error(
      { err, requestId: req.requestId },
      err instanceof Error ? err.message : 'Unexpected error',
    );
  }
  res.status(status).json({ error: { code, message } });
}
