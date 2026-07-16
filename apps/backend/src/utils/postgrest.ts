/**
 * Sanitize user input embedded in PostgREST filter strings (.or(), .filter()).
 * Strips characters that can inject additional filter clauses and escapes ILIKE wildcards.
 */
export function sanitizePostgrestSearchTerm(raw: string, maxLength = 120): string {
  const trimmed = raw.trim().slice(0, maxLength);
  return trimmed
    .replace(/[(),.%\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
