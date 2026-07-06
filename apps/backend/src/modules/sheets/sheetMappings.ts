export const SHEET_SOURCES = {
  fastRental: {
    source: 'Fast Rental',
    rowIdSource: 'fast_rental',
    spreadsheetIdEnv: 'GOOGLE_SHEET_FAST_RENTAL_ID' as const,
    tabName: 'Sheet1',
    headerRow: 2,
    addressHeaderHint: 'address',
  },
  orcha: {
    source: 'Orcha',
    rowIdSource: 'orcha',
    spreadsheetIdEnv: 'GOOGLE_SHEET_ORCHA_ID' as const,
    tabName: 'orcha rentals',
    headerRow: 1,
    addressHeaderHint: 'eft form',
  },
} as const;

export type SheetSourceKey = keyof typeof SHEET_SOURCES;

/** @deprecated use SHEET_SOURCES */
export const sheetMappings = {
  fastRental: {
    source: 'fast_rental',
    spreadsheetIdEnv: 'GOOGLE_SHEET_FAST_RENTAL_ID',
    gidEnv: undefined,
    headerRow: 2,
    tabName: 'Sheet1',
  },
  orcha: {
    source: 'orcha',
    spreadsheetIdEnv: 'GOOGLE_SHEET_ORCHA_ID',
    gidEnv: 'GOOGLE_SHEET_ORCHA_GID',
    headerRow: 1,
    tabName: 'orcha rentals',
  },
} as const;

export const headerAliases = {
  adresse: ['adresse', 'address', 'adresse complete', 'adresse complète', 'logement', 'appartement', 'eft form'],
  quartier: ['quartier', 'secteur', 'area', 'neighbourhood', 'neighborhood'],
  prix: ['prix', 'loyer', 'rent', 'prix/mois', 'prix par mois', '$'],
  taille: ['taille', 'piece', 'pièce', 'pieces', 'pièces', 'size'],
  statut: ['statut', 'status', 'disponibilite', 'disponibilité', 'availability'],
  electromenagers: ['electromenagers', 'électroménagers', 'inclus', 'appliances'],
  code_entree: ['code entree', "code d'entree", "code d'entrée", 'lockbox', 'code', 'entrance code'],
  concierge_tel: ['concierge', 'telephone concierge', 'téléphone concierge', 'contact', 'janitor number'],
  notes: ['notes', 'note', 'commentaire', 'comments', 'details', 'détails'],
  date_disponibilite: ['available on', 'available', 'date disponibilite', 'date disponibilité'],
  locataire_nom: ["tenant's name", 'tenant name', 'locataire', 'nom locataire'],
  locataire_tel: ["tenant's number", 'tenant number', 'telephone locataire', 'tel locataire'],
  latitude: ['latitude', 'lat'],
  longitude: ['longitude', 'lng', 'lon'],
} as const;

const KNOWN_CITIES = [
  'gatineau', 'laval', 'longueuil', 'terrebonne', 'brossard', 'repentigny',
  'saint-jerome', 'st-jerome', 'blainville', 'mirabel', 'chateauguay',
  'greenfield park', 'valleyfield',
];

/** Normalise un libellé de colonne (accents, emoji, casse). */
export function normalizeHeader(value: string) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9$'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateSheetHasAddressColumn(headers: string[], hints: string[] = headerAliases.adresse as unknown as string[]) {
  const normalized = headers.map(normalizeHeader);
  const idx = normalized.findIndex((h) => hints.some((hint) => h === normalizeHeader(hint)));
  if (idx === -1) throw new Error('Missing required address column');
  return idx;
}

export function slugifyAddress(adresse: string) {
  return adresse
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function buildSheetRowId(source: string, adresse: string) {
  return `${source}|${slugifyAddress(adresse)}`;
}

export function textValue(v: unknown) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

export function parseTaille(value: unknown) {
  if (!value && value !== 0) return null;
  const s = String(value)
    .replace(',', '.')
    .replace('½', '.5')
    .replace('¼', '.25')
    .replace('¾', '.75')
    .replace(/[^0-9.]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? String(n) : null;
}

export function parsePrice(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(num) && num > 0 ? Math.round(num) : null;
}

export function mapSheetStatut(value: string | null | undefined) {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return 'Available';
  if (s.includes('rent') || s.includes('lou')) return 'Rented';
  if (s.includes('reno') || s.includes('rénov')) return 'In Reno';
  if (s.includes('not ') || s.includes('unavail') || s.includes('pas dispo')) return 'Not Available';
  if (
    s.includes('hold') || s.includes('wait') || s.includes('pending')
    || s.includes('lease') || s.includes('soon') || s.includes('tal')
  ) return 'On Hold';
  if (s.includes('avail') || s.includes('dispo')) return 'Available';
  return 'Available';
}

/** @deprecated use mapSheetStatut */
export function normalizeStatut(value: string | null | undefined) {
  return mapSheetStatut(value);
}

export function splitQuartierVille(area: string | null | undefined) {
  const a = textValue(area);
  if (!a) return { quartier: null, ville: 'Montréal' };
  const norm = a.toLowerCase();
  for (const city of KNOWN_CITIES) {
    if (norm.includes(city)) {
      const title = city.replace(/\b\w/g, (c) => c.toUpperCase());
      return { quartier: a, ville: title };
    }
  }
  return { quartier: a, ville: 'Montréal' };
}

export type ParsedSheetRow = {
  adresse: string;
  quartier: string | null;
  ville: string;
  prix: number | null;
  taille: string | null;
  electromenagers: string | null;
  code_entree: string | null;
  concierge_tel: string | null;
  notes: string | null;
  statut: string;
  date_disponibilite: string | null;
  locataire_nom: string | null;
  locataire_tel: string | null;
  source: string;
  sheet_row_id: string;
};

export function buildColumnIndex(headers: string[]) {
  const col: Record<string, number> = {};
  headers.forEach((h, i) => {
    const key = normalizeHeader(h);
    if (key && col[key] === undefined) col[key] = i;
  });
  return col;
}

export function getColumnValue(row: string[], col: Record<string, number>, headerName: string) {
  const idx = col[normalizeHeader(headerName)];
  if (idx === undefined) return '';
  return row[idx] ?? '';
}

export function mapFastRentalRow(
  get: (name: string) => string,
  source: string,
  rowIdSource = 'fast_rental',
): ParsedSheetRow | null {
  const adresse = textValue(get('address'));
  if (!adresse || adresse.length <= 2) return null;
  const qv = splitQuartierVille(get('area'));
  return {
    adresse,
    quartier: qv.quartier,
    ville: qv.ville,
    prix: parsePrice(get('price')),
    taille: parseTaille(get('size')),
    electromenagers: textValue(get('appliances')) || null,
    code_entree: textValue(get('entrance code')) || null,
    concierge_tel: textValue(get('janitor number')) || null,
    notes: textValue(get('notes')) || null,
    statut: mapSheetStatut(get('availability')),
    date_disponibilite: textValue(get('available on')) || null,
    locataire_nom: null,
    locataire_tel: null,
    source,
    sheet_row_id: buildSheetRowId(rowIdSource, adresse),
  };
}

export function mapOrchaRow(
  get: (name: string) => string,
  source: string,
  rowIdSource = 'orcha',
): ParsedSheetRow | null {
  const adresse = textValue(get('eft form'));
  if (!adresse || adresse.length <= 2) return null;
  const qv = splitQuartierVille(get('area'));
  return {
    adresse,
    quartier: qv.quartier,
    ville: qv.ville,
    prix: parsePrice(get('$')),
    taille: parseTaille(get('size')),
    electromenagers: textValue(get('appliances')) || null,
    code_entree: textValue(get('entrance code')) || null,
    concierge_tel: textValue(get('janitor number')) || null,
    notes: textValue(get('notes')) || null,
    statut: mapSheetStatut(get('status')),
    date_disponibilite: textValue(get('available')) || null,
    locataire_nom: textValue(get("tenant's name")) || null,
    locataire_tel: textValue(get("tenant's number")) || null,
    source,
    sheet_row_id: buildSheetRowId(rowIdSource, adresse),
  };
}
