export const LISTING_STATUSES = ['Available', 'On Hold', 'Not Available', 'In Reno', 'Rented'] as const;
export const LEAD_STATUSES = ['nouveau', 'archivé'] as const;
export const TRAITEMENT_STATUTS = ['assigné', 'contacté', 'réglé', 'refusé'] as const;
/** Agent “Mes demandes” active queue — not yet closed by the agent. */
export const AGENT_ACTIVE_TRAITEMENT_STATUTS = ['assigné', 'contacté'] as const;
/** Agent personal archive — customer outcome finalized. */
export const AGENT_ARCHIVED_TRAITEMENT_STATUTS = ['réglé', 'refusé'] as const;
export const USER_ROLES = ['admin', 'agent'] as const;
export const MEDIA_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const MEDIA_TYPES = ['image', 'video'] as const;
export const LISTING_SOURCES = ['fast_rental', 'orcha', 'Fast Rental', 'Orcha', 'manual', 'sheet'] as const;

export const MAX_IMAGES_PER_LISTING = 10;
export const MAX_VIDEOS_PER_LISTING = 1;
export const MAX_VIDEO_DURATION_SECONDS = 62;
export const MAX_IMAGE_SIZE_MB = 15;
export const MAX_VIDEO_SIZE_MB = 250;
export const MAX_MAP_LISTINGS = 5000;

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;

export const QUARTIER_COORDS: Record<string, [number, number]> = {
  rosemont: [45.540, -73.580],
  'plateau-mont-royal': [45.525, -73.578],
  'côte-des-neiges': [45.488, -73.626],
  'cote-des-neiges': [45.488, -73.626],
  'st-michel': [45.578, -73.600],
  'saint-michel': [45.578, -73.600],
  'ahuntsic-cartierville': [45.556, -73.666],
  ahuntsic: [45.558, -73.646],
  outremont: [45.527, -73.609],
  villeray: [45.550, -73.607],
  'hochelaga-maisonneuve': [45.547, -73.543],
  hochelaga: [45.548, -73.544],
  'parc-extension': [45.528, -73.638],
  'st-laurent': [45.506, -73.704],
  'saint-laurent': [45.506, -73.704],
  laval: [45.570, -73.790],
  longueuil: [45.520, -73.472],
  'ville-marie': [45.518, -73.568],
  'montréal-nord': [45.590, -73.635],
  lachine: [45.432, -73.673],
  lasalle: [45.427, -73.632],
  verdun: [45.460, -73.573],
  'sud-ouest': [45.474, -73.600],
  westmount: [45.487, -73.590],
  dorval: [45.398, -73.762],
  'pointe-aux-trembles': [45.653, -73.494],
  anjou: [45.606, -73.558],
  'montréal-est': [45.622, -73.505],
  gatineau: [45.422, -75.718],
  boisbriand: [45.618, -73.836],
  'saint-eustache': [45.566, -73.902],
  'deux-montagnes': [45.552, -74.008],
  châteauguay: [45.382, -73.742],
  'greenfield park': [45.486, -73.478],
  'dollard-des-ormeaux': [45.478, -73.824],
  pierrefonds: [45.497, -73.852],
  'trois-rivières': [46.344, -72.546],
  viauville: [45.556, -73.548],
  'st-jérôme': [45.782, -74.002],
};

export const SIZE_LABELS: Record<string, string> = {
  '2.5': '2½',
  '3.5': '3½',
  '4.5': '4½',
  '5.5': '5½',
  '6.5': '6½',
  '7.5': '7½',
};

export function buildActionMessage(
  prefix: 'En application' | 'Request of approval',
  adresse: string,
  prix: string,
  date: string,
  nom: string,
): string {
  return `${prefix} - ${adresse} - ${prix} - ${date} - ${nom}`;
}

export function buildFacebookAd(listing: {
  adresse: string;
  quartier?: string | null;
  prix?: number | string | null;
  taille?: string | null;
  electromenagers?: string | null;
  notes?: string | null;
}, dispo: string, extras: string): string {
  const prix = listing.prix
    ? `${Number(listing.prix).toLocaleString('fr-CA')} $`
    : 'Prix à confirmer';
  const lines: string[] = [];
  lines.push(`🏠 APPARTEMENT À LOUER${listing.quartier ? ` — ${listing.quartier}` : ''}`);
  lines.push('');
  lines.push(`📍 ${listing.adresse}`);
  lines.push(`💰 ${prix} / mois`);
  if (listing.taille) {
    lines.push(`📐 ${SIZE_LABELS[listing.taille] ?? listing.taille} pièces`);
  }
  lines.push('');
  lines.push('✅ INCLUS :');
  if (listing.electromenagers) lines.push(`   🍳 ${listing.electromenagers}`);
  if (extras) {
    extras.split('\n').forEach((e) => {
      if (e.trim()) lines.push(`   ✔️ ${e.trim()}`);
    });
  }
  if (dispo) {
    lines.push('');
    lines.push(`📅 Disponible : ${dispo}`);
  }
  lines.push('');
  lines.push('─────────────────────');
  lines.push('📋 EXIGENCES :');
  lines.push('   ✔️ Emploi ou revenu stable');
  lines.push('   ✔️ Score de crédit minimum 600');
  lines.push('   ✔️ Pas de dossier au TAL');
  lines.push('   ✔️ Vérification de crédit obligatoire (SingleKey)');
  lines.push('');
  lines.push("💬 Envoyez-moi un message pour plus d'informations.");
  lines.push('⚠️ Adresse communiquée après vérification seulement.');
  return lines.join('\n');
}
