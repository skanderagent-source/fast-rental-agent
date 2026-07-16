import type { Request, Response } from 'express';

type RateLimitedRequest = Request & {
  rateLimit?: {
    resetTime?: Date;
  };
};

/** Sets Retry-After (seconds) from express-rate-limit reset time when available. */
export function attachRetryAfterHeader(req: Request, res: Response): void {
  const resetTime = (req as RateLimitedRequest).rateLimit?.resetTime;
  if (!(resetTime instanceof Date)) return;

  const retryAfterSec = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
  res.setHeader('Retry-After', String(retryAfterSec));
}
