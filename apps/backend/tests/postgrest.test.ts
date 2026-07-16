import { describe, expect, it } from 'vitest';
import { sanitizePostgrestSearchTerm } from '../src/utils/postgrest.js';

describe('sanitizePostgrestSearchTerm', () => {
  it('strips PostgREST filter metacharacters', () => {
    expect(sanitizePostgrestSearchTerm('foo,statut.eq.Available')).toBe('foo statut eq Available');
    expect(sanitizePostgrestSearchTerm('test.or.adresse.eq.hacked')).toBe('test or adresse eq hacked');
  });

  it('escapes ILIKE wildcards and trims length', () => {
    expect(sanitizePostgrestSearchTerm('  100% rue  ')).toBe('100 rue');
    expect(sanitizePostgrestSearchTerm('a'.repeat(200)).length).toBeLessThanOrEqual(120);
  });

  it('returns empty string for punctuation-only input', () => {
    expect(sanitizePostgrestSearchTerm(',.%()')).toBe('');
  });
});
