import { QUARTIER_COORDS } from './constants.js';

/** Normalize sheet area / quartier labels for lookup. */
export function normalizeAreaKey(value: string) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const AREA_ALIASES: Record<string, string> = {
  'montreal-north': 'montreal-nord',
  'montreal-norte': 'montreal-nord',
  'montreal-n': 'montreal-nord',
  'pointes-aux-trembles': 'pointe-aux-trembles',
  'pointes-au-trembles': 'pointe-aux-trembles',
  'parc-ex': 'parc-extension',
  'parc-x': 'parc-extension',
  'park-ext': 'parc-extension',
  'park-extension': 'parc-extension',
  'ndg': 'notre-dame-de-grace',
  'notre-dame-grace': 'notre-dame-de-grace',
  'cote-des-neiges-notre-dame': 'cote-des-neiges',
  'plateau-mile-end': 'plateau-mont-royal',
  plateau: 'plateau-mont-royal',
  'rosemont-la-petite-patrie': 'rosemont',
  'montreal-west-city': 'montreal-west',
  'westmount-city': 'westmount',
  'st-jean-sur-r': 'saint-jean-sur-richelieu',
  'st-jean-sur-richelieu': 'saint-jean-sur-richelieu',
  'sent-jerome': 'st-jerome',
  'st-jerome': 'st-jerome',
  'st-leonard': 'saint-leonard',
  'st-laurent': 'saint-laurent',
  'st-michel': 'st-michel',
  'montreal-e': 'montreal-est',
  'montreal-east': 'montreal-est',
  'montreal-est': 'montreal-est',
  'ahuntsic-cartierville': 'ahuntsic-cartierville',
  'hochelaga-maisonneuve': 'hochelaga-maisonneuve',
  'villeray-st-michel': 'villeray',
  'saint-emble': 'saint-eustache',
  'saint-emable': 'saint-eustache',
  'lashin': 'lachine',
  'pierrefonds-roxboro': 'pierrefonds',
  'pierrefonds': 'pierrefonds',
  southwest: 'sud-ouest',
  'ville-marie': 'ville-marie',
  longueuil: 'longueuil',
  laval: 'laval',
};

const NORMALIZED_COORDS = Object.entries(QUARTIER_COORDS).map(([name, coords]) => ({
  key: normalizeAreaKey(name),
  coords,
}));

function resolveAlias(key: string) {
  return AREA_ALIASES[key] ?? key;
}

/** Resolve a sheet area label to map coordinates. */
export function resolveAreaCoords(area: string | null | undefined): [number, number] | null {
  const rawKey = normalizeAreaKey(area ?? '');
  if (!rawKey) return null;

  const key = resolveAlias(rawKey);

  const exact = NORMALIZED_COORDS.find((entry) => entry.key === key);
  if (exact) return exact.coords;

  let bestLength = 0;
  let bestCoords: [number, number] | null = null;
  for (const entry of NORMALIZED_COORDS) {
    if (key.includes(entry.key) || entry.key.includes(key)) {
      if (entry.key.length > bestLength) {
        bestLength = entry.key.length;
        bestCoords = entry.coords;
      }
    }
  }

  return bestCoords;
}

/** Stable grouping key for listings sharing the same area fallback point. */
export function areaCoordsKey(area: string | null | undefined) {
  const coords = resolveAreaCoords(area);
  if (!coords) return null;
  return `${coords[0].toFixed(5)}:${coords[1].toFixed(5)}`;
}
