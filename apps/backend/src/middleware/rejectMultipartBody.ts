import type { NextFunction, Request, Response } from 'express';

/** Presigned and raw proxy uploads use a single binary body, never multipart forms. */
export function rejectMultipartBody(req: Request, res: Response, next: NextFunction) {
  const contentType = String(req.headers['content-type'] ?? '').toLowerCase();
  if (contentType.startsWith('multipart/')) {
    return res.status(415).json({
      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Les téléversements multipart ne sont pas acceptés',
      },
    });
  }
  next();
}
