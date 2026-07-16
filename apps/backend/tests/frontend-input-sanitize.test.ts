import { describe, expect, it } from 'vitest';
import {
  normalizePhoneForApi,
  sanitizeCommentText,
  sanitizeFieldInput,
  sanitizeListingFormFields,
} from '../../frontend/src/lib/inputSanitize.js';

describe('frontend input sanitization', () => {
  it('strips script-like characters from text fields', () => {
    expect(sanitizeFieldInput('<script>alert(1)</script>', 'plain', 100)).toBe('scriptalert(1)/script');
    expect(sanitizeFieldInput('abc\0def', 'search', 10)).toBe('abcdef');
  });

  it('restricts phone and money inputs to allowed characters', () => {
    expect(sanitizeFieldInput('514-abc-0100', 'phone', 30)).toBe('514--0100');
    expect(normalizePhoneForApi('(514) 555-0100')).toBe('5145550100');
    expect(sanitizeFieldInput('12ab34', 'money', 10)).toBe('1234');
  });

  it('sanitizes listing payloads before API validation', () => {
    const cleaned = sanitizeListingFormFields({
      adresse: '123 Rue <Test>',
      quartier: 'Plateau',
      prix: '1500abc',
      taille: '3.5',
      statut: 'Available',
      electromenagers: '',
      code_entree: '1234#',
      concierge_tel: '514-555-0100',
      notes: 'Note ok',
      latitude: '45.5',
      longitude: '-73.5',
    });
    expect(cleaned.adresse).toBe('123 Rue Test');
    expect(cleaned.prix).toBe('1500');
    expect(cleaned.concierge_tel).toBe('5145550100');
  });

  it('sanitizes comment text with length cap', () => {
    expect(sanitizeCommentText('  Bonjour  ')).toBe('Bonjour');
    expect(sanitizeCommentText('<b>x</b>')).toBe('bx/b');
  });
});
