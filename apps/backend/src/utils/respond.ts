import type { Response } from 'express';
import type { ZodSchema } from 'zod';
import { logger } from '../config/logger.js';

/**
 * Validate and project outbound data before serialization. Zod object schemas
 * strip unspecified keys, which keeps internal database fields out of public
 * responses even if a service later returns additional columns.
 */
export function sendValidatedData(
  res: Response,
  schema: ZodSchema,
  data: unknown,
  status = 200,
) {
  const result = schema.safeParse(data);
  if (!result.success) {
    logger.error(
      { issues: result.error.issues },
      'Outbound response failed schema validation',
    );
    throw new Error('Outbound response schema validation failed');
  }
  res.status(status).json({ data: result.data });
}
