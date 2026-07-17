import { describe, expect, it } from 'vitest';
import {
  buildAreaGeocodeQuery,
  buildGeocodeQuery,
  normalizeGeocodeAddress,
  sanitizeGeocodePart,
} from '../src/modules/listings/listings.geocode.helpers.js';

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

  it('sanitizes trailing commas from sheet values', () => {
    expect(sanitizeGeocodePart('587 Rue Saint-Georges, ')).toBe('587 Rue Saint-Georges');
    expect(buildGeocodeQuery({
      adresse: '587 Rue Saint-Georges, ',
      quartier: 'South Shore',
      ville: 'Montréal',
    })).toBe('587 Rue Saint-Georges, South Shore, Montréal, Québec, Canada');
  });

  it('buildAreaGeocodeQuery uses the area column as fallback', () => {
    expect(buildAreaGeocodeQuery({
      quartier: 'Hochelaga Maisonneuve',
      ville: 'Montréal',
    })).toBe('Hochelaga Maisonneuve, Montréal, Québec, Canada');
    expect(buildAreaGeocodeQuery({ quartier: null, ville: 'Montréal' })).toBeNull();
  });

  it('normalizeGeocodeAddress strips accents and lowercases', () => {
    expect(normalizeGeocodeAddress('Montréal, Québec')).toBe('montreal, quebec');
  });
});
