export function sanitizeGeocodePart(value: string) {
  return String(value ?? '')
    .replace(/,\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildGeocodeQuery(listing: {
  adresse: string;
  quartier: string | null;
  ville: string | null;
}) {
  const adresse = sanitizeGeocodePart(listing.adresse);
  const parts = [adresse];
  const quartier = sanitizeGeocodePart(listing.quartier ?? '');
  if (quartier) parts.push(quartier);
  parts.push(listing.ville || 'Montréal');
  parts.push('Québec, Canada');
  return parts.join(', ');
}

export function buildAreaGeocodeQuery(listing: {
  quartier: string | null;
  ville: string | null;
}) {
  const quartier = sanitizeGeocodePart(listing.quartier ?? '');
  if (!quartier) return null;
  return `${quartier}, ${listing.ville || 'Montréal'}, Québec, Canada`;
}

export function normalizeGeocodeAddress(query: string) {
  return query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
