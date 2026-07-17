import { describe, expect, it } from 'vitest';
import { areaCoordsKey, normalizeAreaKey, resolveAreaCoords } from '@fast-rental/shared';

describe('area coordinate lookup', () => {
  it('normalizes sheet area labels', () => {
    expect(normalizeAreaKey('Rosemont-La-Petite-Patrie')).toBe('rosemont-la-petite-patrie');
    expect(normalizeAreaKey('St. Michel -')).toBe('st-michel');
    expect(normalizeAreaKey('Montreal West(city)')).toBe('montreal-west-city');
  });

  it('resolves common Fast Rental and Orcha area labels', () => {
    expect(resolveAreaCoords('ahuntsic cartierville')).toEqual([45.556, -73.666]);
    expect(resolveAreaCoords('parc ex')).toEqual([45.528, -73.638]);
    expect(resolveAreaCoords('Rosemont-La-Petite-Patrie')).toEqual([45.540, -73.580]);
    expect(resolveAreaCoords('South Shore')).toEqual([45.518, -73.435]);
    expect(resolveAreaCoords('Montreal West(city)')).toEqual([45.457, -73.641]);
    expect(resolveAreaCoords('montreal north')).toEqual([45.590, -73.635]);
    expect(resolveAreaCoords('Notre Dame Grace')).toEqual([45.477, -73.614]);
    expect(resolveAreaCoords('Cowansville,')).toEqual([45.206, -72.747]);
  });

  it('groups listings by stable area key', () => {
    expect(areaCoordsKey('Rosemont')).toBe(areaCoordsKey('rosemont'));
    expect(areaCoordsKey('unknown place xyz')).toBeNull();
  });
});
