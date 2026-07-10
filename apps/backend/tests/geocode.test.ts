import { describe, expect, it } from 'vitest';
import { buildGeocodeQuery, normalizeGeocodeAddress } from '../src/modules/listings/listings.geocode.helpers.js';

describe('geocoding helpers', () => {
  it('buildGeocodeQuery includes adresse, quartier, ville and Québec', () => {
    expect(buildGeocodeQuery({
      adresse: '4037 Adam',
      quartier: 'Rosemont',
      ville: 'Montréal',
    })).toBe('4037 Adam, Rosemont, Montréal, Québec, Canada');
  });

  it('buildGeocodeQuery defaults ville to Montréal', () => {
    expect(buildGeocodeQuery({
      adresse: '123 Rue Test',
      quartier: null,
      ville: null,
    })).toBe('123 Rue Test, Montréal, Québec, Canada');
  });

  it('normalizeGeocodeAddress strips accents and lowercases', () => {
    expect(normalizeGeocodeAddress('Montréal, Québec')).toBe('montreal, quebec');
  });
});
