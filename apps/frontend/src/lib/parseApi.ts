import type { ZodType } from 'zod';
import { ApiError } from './apiClient';

export function parseApi<T>(schema: ZodType<T>, data: unknown, label = 'API response'): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError(502, 'INVALID_API_RESPONSE', `${label} invalide`);
  }
  return parsed.data;
}
