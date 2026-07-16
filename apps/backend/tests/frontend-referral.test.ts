import { describe, expect, it } from 'vitest';
import { resolveAgentReferralUsername, referralUsernameFromNom } from '@fast-rental/shared';

describe('frontend referral usernames', () => {
  it('prefers agents.nom for referral links', () => {
    expect(resolveAgentReferralUsername({
      nom: 'frepoc',
      referral_slug: 'frenkipocari2d2b3b',
    })).toBe('frepoc');
    expect(referralUsernameFromNom('Fre Poc')).toBe('frepoc');
  });

  it('falls back to referral_slug only when it matches nom, not email-derived values', () => {
    expect(resolveAgentReferralUsername({
      nom: 'frepoc',
      referral_slug: 'frenkipocari2d2b3b',
    })).toBe('frepoc');

    expect(resolveAgentReferralUsername({
      nom: 'frepoc',
      referral_slug: 'frepoc',
    })).toBe('frepoc');

    expect(resolveAgentReferralUsername({
      nom: 'ab',
      referral_slug: 'frepoc',
    })).toBeNull();
  });

  it('rejects nom values that cannot become a valid username without email slug fallback', () => {
    expect(resolveAgentReferralUsername({ nom: 'ab', referral_slug: 'frenkipocari' })).toBeNull();
    expect(resolveAgentReferralUsername({ nom: '!!', referral_slug: 'agenttest' })).toBeNull();
  });
});
