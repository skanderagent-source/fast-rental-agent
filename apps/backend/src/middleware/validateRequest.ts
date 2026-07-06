import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

export function validateRequest(schema: ZodSchema, source: 'body' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(source === 'body' ? req.body : req.query);
    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: result.error.flatten(),
        },
      });
    }
    if (source === 'body') req.body = result.data;
    else req.query = result.data as Request['query'];
    next();
  };
}
