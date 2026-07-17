export const LISTING_STATUSES = ['Available', 'On Hold', 'Not Available', 'In Reno', 'Rented'] as const;
export const LEAD_STATUSES = ['nouveau', 'archivé'] as const;
export const TRAITEMENT_STATUTS = ['assigné', 'contacté', 'réglé', 'refusé'] as const;
/** Agent “Mes demandes” active queue — not yet closed by the agent. */
export const AGENT_ACTIVE_TRAITEMENT_STATUTS = ['assigné', 'contacté'] as const;
/** Agent personal archive — customer outcome finalized. */
export const AGENT_ARCHIVED_TRAITEMENT_STATUTS = ['réglé', 'refusé'] as const;
export const USER_ROLES = ['admin', 'agent'] as const;
export const SENSITIVE_ACTIONS = [
  'user.update',
  'user.deactivate',
  'user.reactivate',
  'user.delete',
  'listing.delete',
  'lead.delete',
  'media.delete',
  'comment.delete',
  'sheets.import',
  'sheets.sync',
] as const;
export type SensitiveAction = (typeof SENSITIVE_ACTIONS)[number];
export const MEDIA_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const MEDIA_TYPES = ['image', 'video'] as const;
export const LISTING_SOURCES = ['fast_rental', 'orcha', 'Fast Rental', 'Orcha', 'manual', 'sheet'] as const;

export const MAX_IMAGES_PER_LISTING = 10;
export const MAX_VIDEOS_PER_LISTING = 1;
export const MAX_VIDEO_DURATION_SECONDS = 62;
/** Shown to admins/agents; actual limit is {@link MAX_VIDEO_DURATION_SECONDS} for metadata headroom. */
export const MAX_VIDEO_DURATION_DISPLAY_SECONDS = 60;
export const MAX_IMAGE_SIZE_MB = 15;
export const MAX_VIDEO_SIZE_MB = 250;
/** Reject decompression bombs and oversized listing photos after upload inspection. */
export const MAX_IMAGE_PIXEL_DIMENSION = 8192;
export const MAX_MAP_LISTINGS = 5000;
/** Hard cap on rows loaded for listing search/sort to prevent memory exhaustion. */
export const MAX_LISTING_SEARCH_ROWS = 2500;
/** Hard caps on unpaginated authenticated list endpoints. */
export const MAX_USERS_LIST = 500;
export const MAX_AGENT_CALLS = 500;
export const MAX_RENTALS_LIST = 500;

export const LISTING_SIZE_VALUES = ['2.5', '3.5', '4.5', '5.5', '6.5', '7.5'] as const;
export const LISTING_FILTER_SOURCES = ['Fast Rental', 'Orcha', 'manual', 'fast_rental', 'orcha', 'sheet'] as const;

export const PASSWORD_MIN_LENGTH = 10;

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;

export const REFERRAL_USERNAME_MIN_LENGTH = 3;
export const REFERRAL_USERNAME_MAX_LENGTH = 32;
export const REFERRAL_USERNAME_PATTERN = /^[a-z0-9]+$/;

export function normalizeReferralUsername(value: string): string {
  return value.trim().toLowerCase();
}

/** Strip dots and other symbols — used when deriving a default from email. */
export function sanitizeReferralUsername(value: string): string {
  return normalizeReferralUsername(value).replace(/[^a-z0-9]/g, '');
}

export function isValidReferralUsername(value: string): boolean {
  const normalized = normalizeReferralUsername(value);
  return (
    normalized.length >= REFERRAL_USERNAME_MIN_LENGTH &&
    normalized.length <= REFERRAL_USERNAME_MAX_LENGTH &&
    REFERRAL_USERNAME_PATTERN.test(normalized)
  );
}

export function referralSlugFromEmail(email: string): string {
  const sanitized = sanitizeReferralUsername(email.split('@')[0] ?? '');
  if (isValidReferralUsername(sanitized)) return sanitized;
  if (sanitized.length > REFERRAL_USERNAME_MAX_LENGTH) {
    return sanitized.slice(0, REFERRAL_USERNAME_MAX_LENGTH);
  }
  return 'agent';
}

/** Referral URL segment from agents.nom (e.g. profile display name "frepoc"). */
export function referralUsernameFromNom(nom: string | null | undefined): string | null {
  const username = sanitizeReferralUsername(nom ?? '');
  return isValidReferralUsername(username) ? username : null;
}

/** Join site origin + path without duplicate slashes when base URL ends with `/`. */
export function joinPublicUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

/** Referral links always use the username derived from agents.nom. */
export function resolveAgentReferralUsername(profile: {
  nom: string | null | undefined;
  referral_slug?: string | null;
}): string | null {
  return referralUsernameFromNom(profile.nom);
}

export function parseTraitementStatut(value: string | null | undefined): (typeof TRAITEMENT_STATUTS)[number] {
  if (value && (TRAITEMENT_STATUTS as readonly string[]).includes(value)) {
    return value as (typeof TRAITEMENT_STATUTS)[number];
  }
  return 'assigné';
}

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
  chateauguay: [45.382, -73.742],
  'greenfield park': [45.486, -73.478],
  'dollard-des-ormeaux': [45.478, -73.824],
  pierrefonds: [45.497, -73.852],
  'trois-rivières': [46.344, -72.546],
  'trois-rivieres': [46.344, -72.546],
  viauville: [45.556, -73.548],
  'st-jérôme': [45.782, -74.002],
  'st-jerome': [45.782, -74.002],
  'south-shore': [45.518, -73.435],
  'montreal-west': [45.457, -73.641],
  'notre-dame-de-grace': [45.477, -73.614],
  'montreal-nord': [45.590, -73.635],
  'saint-leonard': [45.589, -73.594],
  'montreal-est': [45.622, -73.505],
  cowansville: [45.206, -72.747],
  repentigny: [45.733, -73.466],
  'sainte-therese': [45.640, -73.836],
  'saint-jean-sur-richelieu': [45.316, -73.262],
  beauharnois: [45.317, -73.872],
  'sainte-catherine': [45.400, -73.582],
  farnham: [45.283, -72.983],
  mascouche: [45.751, -73.610],
  'saint-charles-borromee': [46.051, -73.465],
  'anne-de-bellevue': [45.404, -73.947],
  'cote-saint-luc': [45.468, -73.669],
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
  return lines.join('\n');
}
