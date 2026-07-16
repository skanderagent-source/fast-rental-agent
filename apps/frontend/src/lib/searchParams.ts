import { sanitizeFieldInput, type FieldKind } from './inputSanitize';

export function sanitizeFreeTextParam(
  value: string | null | undefined,
  maxLength: number,
  kind: FieldKind = 'search',
): string {
  if (!value) return '';
  return sanitizeFieldInput(value, kind, maxLength);
}

export function sanitizeEnumParam<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
): string {
  if (!value) return '';
  const cleaned = sanitizeFieldInput(value, 'plain', 120).trim();
  return (allowed as readonly string[]).includes(cleaned) ? cleaned : '';
}
