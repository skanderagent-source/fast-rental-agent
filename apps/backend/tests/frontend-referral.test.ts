import { describe, expect, it } from 'vitest';
import {
  joinPublicUrl,
  referralUsernameFromNom,
  resolveAgentReferralUsername,
} from '@fast-rental/shared';

describe('frontend referral usernames', () => {
  it('derives referral links from agents.nom only', () => {
    expect(resolveAgentReferralUsername({
      nom: 'frepoc',
      referral_slug: 'frenkipocari2d2b3b',
    })).toBe('frepoc');
    expect(referralUsernameFromNom('Fre Poc')).toBe('frepoc');
  });

  it('ignores email-derived referral_slug values', () => {
    expect(resolveAgentReferralUsername({
      nom: 'frepoc',
      referral_slug: 'frenkipocari2d2b3b',
    })).toBe('frepoc');

    expect(resolveAgentReferralUsername({
      nom: 'frepoc',
      referral_slug: 'frepoc',
    })).toBe('frepoc');
  });

  it('rejects nom values that cannot become a valid username', () => {
    expect(resolveAgentReferralUsername({ nom: 'ab', referral_slug: 'frenkipocari' })).toBeNull();
    expect(resolveAgentReferralUsername({ nom: '!!', referral_slug: 'agenttest' })).toBeNull();
  });
});

describe('referral URL building', () => {
  const listingId = 'd5b4c37b-cb67-4871-9707-49efa5bd84f6';

  it('joinPublicUrl avoids double slashes when base URL has trailing slash', () => {
    expect(joinPublicUrl('https://www.logigo.ca/', '/inventaire/frepoc')).toBe(
      'https://www.logigo.ca/inventaire/frepoc',
    );
    expect(joinPublicUrl('https://www.logigo.ca', '/inventaire/frepoc')).toBe(
      'https://www.logigo.ca/inventaire/frepoc',
    );
    expect(
      joinPublicUrl(
        'https://www.logigo.ca/',
        `/inventaire/frepoc?listing=${listingId}`,
      ),
    ).toBe(`https://www.logigo.ca/inventaire/frepoc?listing=${listingId}`);
  });
});
