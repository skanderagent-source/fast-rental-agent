import { describe, expect, it } from 'vitest';
import {
  buildSheetRowId,
  dedupeParsedSheetRows,
  mapFastRentalRow,
  mapOrchaRow,
  mapSheetStatut,
  normalizeHeader,
  splitQuartierVille,
  validateSheetHasAddressColumn,
} from '../src/modules/sheets/sheetMappings.js';

describe('sheet mappings', () => {
  it('normalizes headers with emoji and accents', () => {
    expect(normalizeHeader('📍 Address')).toBe('address');
    expect(normalizeHeader('Eft form')).toBe('eft form');
  });

  it('validates address column aliases', () => {
    expect(validateSheetHasAddressColumn(['Address', 'Price'])).toBe(0);
    expect(validateSheetHasAddressColumn(['Eft form', 'Area'])).toBe(0);
    expect(() => validateSheetHasAddressColumn(['Prix', 'Quartier'])).toThrow(/Missing required address column/i);
  });

  it('maps Fast Rental row', () => {
    const get = (name: string) => ({
      address: '123 Rue Test',
      area: 'Rosemont',
      price: '$1,200',
      size: '3.5',
      availability: 'Available',
    }[name] ?? '');
    const row = mapFastRentalRow(get, 'Fast Rental', 'fast_rental');
    expect(row?.adresse).toBe('123 Rue Test');
    expect(row?.prix).toBe(1200);
    expect(row?.source).toBe('Fast Rental');
    expect(row?.sheet_row_id).toBe(buildSheetRowId('fast_rental', '123 Rue Test'));
    expect(row?.locataire_nom).toBeNull();
  });

  it('maps Orcha row with eft form address and tenant fields', () => {
    const get = (name: string) => ({
      'eft form': '456 Orcha Ave',
      area: 'Laval',
      $: '950',
      status: 'rented',
      "tenant's name": 'Jean Dupont',
      "tenant's number": '514-555-1234',
    }[name] ?? '');
    const row = mapOrchaRow(get, 'Orcha', 'orcha');
    expect(row?.adresse).toBe('456 Orcha Ave');
    expect(row?.source).toBe('Orcha');
    expect(row?.statut).toBe('Rented');
    expect(row?.locataire_nom).toBe('Jean Dupont');
    expect(row?.ville).toMatch(/Laval/i);
    expect(row?.notes).toBeNull();
  });

  it('maps varied statut labels', () => {
    expect(mapSheetStatut('On hold')).toBe('On Hold');
    expect(mapSheetStatut('Loué')).toBe('Rented');
    expect(mapSheetStatut('In reno')).toBe('In Reno');
  });

  it('detects known cities in area', () => {
    expect(splitQuartierVille('Parc Laval').ville).toMatch(/Laval/i);
    expect(splitQuartierVille('Plateau').ville).toBe('Montréal');
  });

  it('keeps the bottom-most duplicate sheet row', () => {
    const first = mapFastRentalRow(
      (name) => ({ address: '123 Rue Test', price: '1000' }[name] ?? ''),
      'Fast Rental',
    )!;
    const last = { ...first, prix: 1250 };

    expect(dedupeParsedSheetRows([first, last])).toEqual([last]);
  });
});
