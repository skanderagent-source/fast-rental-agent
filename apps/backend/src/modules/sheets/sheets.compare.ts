export const SHEET_DATA_FIELDS = [
  'adresse',
  'quartier',
  'ville',
  'prix',
  'taille',
  'statut',
  'electromenagers',
  'code_entree',
  'concierge_tel',
  'notes',
  'date_disponibilite',
  'locataire_nom',
  'locataire_tel',
  'source',
] as const;

export type SheetDataField = (typeof SHEET_DATA_FIELDS)[number];

const ADDRESS_FIELDS: SheetDataField[] = ['adresse', 'quartier', 'ville'];

export function normalizeComparableValue(field: SheetDataField, value: unknown): string | number | null {
  if (value === null || value === undefined || value === '') return null;
  if (field === 'prix') {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return String(value).trim();
}

export function sheetValuesEqual(field: SheetDataField, current: unknown, incoming: unknown) {
  return normalizeComparableValue(field, current) === normalizeComparableValue(field, incoming);
}

/** Build a partial update with only fields that differ from the DB row. */
export function buildChangedSheetUpdates(
  existing: Record<string, unknown>,
  payload: Record<string, unknown>,
  overrides: Record<string, boolean> = {},
): Record<string, unknown> | null {
  const updates: Record<string, unknown> = {};

  for (const key of SHEET_DATA_FIELDS) {
    if (overrides[key]) continue;
    const incoming = payload[key];
    const current = existing[key];
    if (!sheetValuesEqual(key, current, incoming)) {
      updates[key] = incoming ?? null;
    }
  }

  if (Object.keys(updates).length === 0) return null;

  updates.sheet_row_id = payload.sheet_row_id;
  updates.sheet_updated_at = new Date().toISOString();

  if (ADDRESS_FIELDS.some((field) => field in updates)) {
    updates.geocoded_at = null;
    updates.geocoding_status = 'pending';
    updates.geocoding_error = null;
  }

  return updates;
}

export function hasAddressFieldChange(updates: Record<string, unknown>) {
  return ADDRESS_FIELDS.some((field) => field in updates);
}
