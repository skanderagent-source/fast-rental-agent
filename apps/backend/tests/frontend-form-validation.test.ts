import { describe, expect, it } from 'vitest';
import { agentProfileSchema, toAgentProfile, uuidParamSchema } from '@fast-rental/shared';
import {
  formatCurrency,
  parseListingCreatePayload,
  parseLoginEmail,
  parseRouteId,
} from '../../frontend/src/lib/formValidation.js';
import { secureRandomId } from '../../frontend/src/lib/secureRandom.js';

describe('frontend form validation', () => {
  it('validates login email and listing payloads with shared schemas', () => {
    expect(parseLoginEmail('agent@example.com')).toBe('agent@example.com');
    expect(parseLoginEmail('not-an-email')).toBeNull();

    const listing = parseListingCreatePayload({
      adresse: '123 Rue Test',
      quartier: 'Plateau',
      prix: '1500',
      taille: '3.5',
      statut: 'Available',
      electromenagers: '',
      code_entree: '',
      concierge_tel: '',
      notes: '',
      latitude: '',
      longitude: '',
    });
    expect(listing.success).toBe(true);
  });

  it('rejects invalid route ids and formats currency safely', () => {
    expect(parseRouteId('00000000-0000-4000-8000-000000000001')).toBeTruthy();
    expect(parseRouteId('not-a-uuid')).toBeNull();
    expect(formatCurrency('1500')).toBe('$1\u00a0500');
    expect(formatCurrency('abc')).toBeNull();
  });

  it('parses agent profile responses at the auth boundary', () => {
    const parsed = agentProfileSchema.safeParse({
      id: '00000000-0000-4000-8000-000000000001',
      email: 'agent@example.com',
      nom: 'Agent Test',
      telephone: null,
      role: 'agent',
      actif: true,
      must_change_password: false,
      referral_slug: 'agenttest',
    });
    expect(parsed.success).toBe(true);
    expect(uuidParamSchema.safeParse('00000000-0000-4000-8000-000000000001').success).toBe(true);
  });

  it('strips extra database columns from agent profile responses', () => {
    const parsed = agentProfileSchema.safeParse({
      id: '00000000-0000-4000-8000-000000000001',
      email: 'agent@example.com',
      nom: 'Agent Test',
      telephone: null,
      role: 'agent',
      actif: true,
      must_change_password: false,
      referral_slug: 'agenttest',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      profile_photo_media_id: null,
    });
    expect(parsed.success).toBe(false);
  });

  it('maps database rows to the public agent profile shape', () => {
    const profile = toAgentProfile({
      id: '00000000-0000-4000-8000-000000000001',
      email: 'agent@example.com',
      nom: 'Agent Test',
      telephone: null,
      role: 'agent',
      actif: true,
      must_change_password: false,
      referral_slug: 'agenttest',
      created_at: '2024-01-01T00:00:00.000Z',
    });
    expect(profile.referral_slug).toBe('agenttest');
    expect(profile).not.toHaveProperty('created_at');
  });

  it('uses crypto.getRandomValues for client-generated ids', () => {
    const first = secureRandomId(8);
    const second = secureRandomId(8);
    expect(first).toHaveLength(16);
    expect(second).toHaveLength(16);
    expect(first).not.toBe(second);
  });
});
