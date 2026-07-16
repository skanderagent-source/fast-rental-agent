import type { RequestHandler } from 'express';

const PRIVATE_CACHE_CONTROL = 'no-store, no-cache, must-revalidate, private';

/**
 * Prevents shared caches and browser history from retaining authenticated API payloads.
 * Public listing endpoints under /api/public are excluded so CDN caching remains possible.
 */
export const preventPrivateResponseCaching: RequestHandler = (req, res, next) => {
  if (req.path.startsWith('/public')) {
    return next();
  }
  res.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};
