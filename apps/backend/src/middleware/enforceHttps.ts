import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

/**
 * Defense-in-depth HTTPS redirect for production.
 *
 * Caddy remains the primary TLS termination point and sets X-Forwarded-Proto.
 * The redirect is intentionally disabled outside production so local
 * development and test clients can continue using HTTP.
 */
export function enforceHttps(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== 'production' || req.secure) {
    return next();
  }

  const configuredApiUrl = new URL(env.PUBLIC_API_BASE_URL);
  configuredApiUrl.protocol = 'https:';
  const httpsApiOrigin = configuredApiUrl.origin;
  return res.redirect(308, `${httpsApiOrigin}${req.originalUrl}`);
}
