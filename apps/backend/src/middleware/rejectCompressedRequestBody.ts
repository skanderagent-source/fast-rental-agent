import type { NextFunction, Request, Response } from 'express';

const BLOCKED_REQUEST_CONTENT_ENCODINGS = new Set([
  'gzip',
  'x-gzip',
  'deflate',
  'br',
  'compress',
  'zstd',
]);

/**
 * Express does not safely bound decompressed request bodies by default.
 * The API accepts only plain JSON/urlencoded/text/raw uploads.
 */
export function rejectCompressedRequestBody(req: Request, res: Response, next: NextFunction) {
  const encoding = String(req.headers['content-encoding'] ?? '')
    .toLowerCase()
    .split(',')[0]
    ?.trim();

  if (!encoding || !BLOCKED_REQUEST_CONTENT_ENCODINGS.has(encoding)) {
    return next();
  }

  return res.status(415).json({
    error: {
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'Les corps de requête compressés ne sont pas acceptés',
    },
  });
}
