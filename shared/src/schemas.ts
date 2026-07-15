import { z } from 'zod';
import {
  IMAGE_MIME_TYPES,
  LISTING_STATUSES,
  MAX_IMAGE_SIZE_MB,
  MAX_VIDEO_DURATION_DISPLAY_SECONDS,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_SIZE_MB,
  REFERRAL_USERNAME_MAX_LENGTH,
  REFERRAL_USERNAME_MIN_LENGTH,
  REFERRAL_USERNAME_PATTERN,
  TRAITEMENT_STATUTS,
  USER_ROLES,
  VIDEO_MIME_TYPES,
} from './constants.js';

export const createListingSchema = z.object({
  adresse: z.string().min(1),
  quartier: z.string().optional().nullable(),
  prix: z.coerce.number().optional().nullable(),
  taille: z.string().optional().nullable(),
  statut: z.enum(LISTING_STATUSES).default('Available'),
  electromenagers: z.string().optional().nullable(),
  code_entree: z.string().optional().nullable(),
  concierge_tel: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  source: z.string().default('manual'),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
});

export const updateListingSchema = createListingSchema.partial();

export const assignLeadSchema = z.object({
  agentId: z.string().uuid(),
});

export const updateLeadProgressSchema = z.object({
  traitementStatut: z.enum(TRAITEMENT_STATUTS),
});

export const createCommentSchema = z.object({
  texte: z.string().min(1).max(5000),
});

export const createUserSchema = z.object({
  nom: z.string().min(1),
  email: z.string().email(),
  telephone: z.union([z.string().trim().min(6).max(30), z.literal('')]).optional(),
  password: z.string().min(6),
  role: z.enum(USER_ROLES),
});

export const updateUserSchema = z.object({
  nom: z.string().min(1).optional(),
  role: z.enum(USER_ROLES).optional(),
  actif: z.boolean().optional(),
});

export const updateUserReferralSlugSchema = z.object({
  referralSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(REFERRAL_USERNAME_MIN_LENGTH, `Min. ${REFERRAL_USERNAME_MIN_LENGTH} caractères`)
    .max(REFERRAL_USERNAME_MAX_LENGTH, `Max. ${REFERRAL_USERNAME_MAX_LENGTH} caractères`)
    .regex(REFERRAL_USERNAME_PATTERN, 'Lettres et chiffres seulement (a-z, 0-9)'),
});

export const requestMediaUploadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.coerce.number().positive(),
  type: z.enum(['image', 'video']),
  durationSeconds: z.coerce.number().positive().optional(),
}).superRefine((data, ctx) => {
  if (data.type !== 'video') return;
  if (data.durationSeconds == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Durée vidéo requise',
      path: ['durationSeconds'],
    });
    return;
  }
  const durationError = validateVideoDuration(data.durationSeconds);
  if (durationError) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: durationError,
      path: ['durationSeconds'],
    });
  }
});

export const approveMediaSchema = z.object({
  reason: z.string().optional(),
});

export const rejectMediaSchema = z.object({
  reason: z.string().optional(),
});

export const reorderListingMediaSchema = z.object({
  mediaIds: z.array(z.string().uuid()).min(1),
});

export const updateProfileSchema = z.object({
  nom: z.string().min(1).optional(),
  telephone: z.string().trim().min(6).max(30).nullable().optional(),
  profilePhotoMediaId: z.string().uuid().nullable().optional(),
});

export const profilePhotoUploadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.enum(IMAGE_MIME_TYPES),
  sizeBytes: z.coerce.number().max(MAX_IMAGE_SIZE_MB * 1024 * 1024),
});

export const createRentalSchema = z.object({
  listingId: z.string().uuid(),
  leadId: z.string().uuid().optional().nullable(),
  agentId: z.string().uuid().optional(),
  monthlyRent: z.coerce.number().optional().nullable(),
  rentedAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const listingsQuerySchema = z.object({
  q: z.string().optional(),
  quartier: z.string().optional(),
  statut: z.string().optional(),
  taille: z.string().optional(),
  source: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(5000).default(50),
});

export const leadsQuerySchema = z.object({
  includeArchived: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true'),
  assignedTo: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.string().uuid().optional(),
  ),
  archivedFrom: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ),
  archivedTo: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
});

export function validateMediaMime(type: 'image' | 'video', mimeType: string, sizeBytes: number) {
  if (type === 'image') {
    if (!IMAGE_MIME_TYPES.includes(mimeType as (typeof IMAGE_MIME_TYPES)[number])) {
      return 'Type MIME image non supporté';
    }
    if (sizeBytes > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      return `Image trop grande (max ${MAX_IMAGE_SIZE_MB} Mo)`;
    }
  } else {
    if (!VIDEO_MIME_TYPES.includes(mimeType as (typeof VIDEO_MIME_TYPES)[number])) {
      return 'Type MIME vidéo non supporté';
    }
    if (sizeBytes > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      return `Vidéo trop grande (max ${MAX_VIDEO_SIZE_MB} Mo)`;
    }
  }
  return null;
}

export function validateVideoDuration(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 'Durée vidéo invalide';
  }
  if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
    return `Vidéo trop longue (max ${MAX_VIDEO_DURATION_DISPLAY_SECONDS} secondes)`;
  }
  return null;
}
