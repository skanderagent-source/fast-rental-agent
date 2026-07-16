import { badRequest } from './httpErrors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function paramId(value: string | string[]): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id || !UUID_PATTERN.test(id)) {
    throw badRequest('Identifiant invalide', 'INVALID_ID');
  }
  return id;
}
