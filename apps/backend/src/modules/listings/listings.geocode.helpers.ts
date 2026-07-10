export function buildGeocodeQuery(listing: {
  adresse: string;
  quartier: string | null;
  ville: string | null;
}) {
  const parts = [listing.adresse];
  if (listing.quartier) parts.push(listing.quartier);
  parts.push(listing.ville || 'Montréal');
  parts.push('Québec, Canada');
  return parts.join(', ');
}

export function normalizeGeocodeAddress(query: string) {
  return query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
