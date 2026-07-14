import { describe, expect, it } from 'vitest';
import {
  buildChangedSheetUpdates,
  hasAddressFieldChange,
  sheetValuesEqual,
} from '../src/modules/sheets/sheets.compare.js';

describe('sheet change detection', () => {
  const basePayload = {
    adresse: '123 Rue Test',
    quartier: 'Rosemont',
    ville: 'Montréal',
    prix: 1200,
    taille: '3.5',
    statut: 'Available',
    electromenagers: 'Frigo',
    code_entree: '1234',
    concierge_tel: '514-555-0000',
    notes: null,
    date_disponibilite: null,
    locataire_nom: null,
    locataire_tel: null,
    source: 'Fast Rental',
    sheet_row_id: 'fast_rental|123ruetest',
  };

  it('returns null when sheet row matches existing data', () => {
    const existing = { ...basePayload, prix: '1200' };
    expect(buildChangedSheetUpdates(existing, basePayload)).toBeNull();
  });

  it('returns only changed fields', () => {
    const existing = { ...basePayload, prix: 1100, statut: 'On Hold' };
    const updates = buildChangedSheetUpdates(existing, basePayload);
    expect(updates).toMatchObject({
      prix: 1200,
      statut: 'Available',
      sheet_row_id: basePayload.sheet_row_id,
    });
    expect(updates).not.toHaveProperty('adresse');
  });

  it('ignores fields protected by manual_overrides', () => {
    const existing = { ...basePayload, prix: 1100 };
    const updates = buildChangedSheetUpdates(existing, basePayload, { prix: true });
    expect(updates).toBeNull();
  });

  it('marks geocoding pending when address fields change', () => {
    const existing = { ...basePayload, adresse: '999 Autre Rue' };
    const updates = buildChangedSheetUpdates(existing, basePayload);
    expect(updates).toMatchObject({
      geocoded_at: null,
      geocoding_status: 'pending',
      geocoding_error: null,
    });
    expect(updates).not.toHaveProperty('latitude');
    expect(updates).not.toHaveProperty('longitude');
    expect(hasAddressFieldChange(updates!)).toBe(true);
  });

  it('treats null and empty string as equal', () => {
    expect(sheetValuesEqual('notes', null, '')).toBe(true);
    expect(sheetValuesEqual('prix', 1200, '1200')).toBe(true);
  });
});
