import type { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status: number }).status) : 500;
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: string }).code) : 'INTERNAL_ERROR';
  const message = err instanceof Error ? err.message : 'Unexpected error';
  if (status >= 500) logger.error({ err }, message);
  res.status(status).json({ error: { code, message } });
}
