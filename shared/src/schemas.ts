import { z } from 'zod';
import {
  IMAGE_MIME_TYPES,
  LISTING_FILTER_SOURCES,
  LISTING_SIZE_VALUES,
  LISTING_STATUSES,
  MAX_IMAGE_SIZE_MB,
  MAX_VIDEO_DURATION_DISPLAY_SECONDS,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_SIZE_MB,
  PASSWORD_MIN_LENGTH,
  REFERRAL_USERNAME_MAX_LENGTH,
  REFERRAL_USERNAME_MIN_LENGTH,
  REFERRAL_USERNAME_PATTERN,
  SENSITIVE_ACTIONS,
  TRAITEMENT_STATUTS,
  USER_ROLES,
  VIDEO_MIME_TYPES,
} from './constants.js';

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Minimum ${PASSWORD_MIN_LENGTH} caractères`)
  .max(128, 'Maximum 128 caractères')
  .regex(/[A-Za-z]/, 'Le mot de passe doit contenir au moins une lettre')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre');

export const createListingSchema = z.object({
  adresse: z.string().trim().min(1).max(500),
  quartier: z.string().trim().max(120).optional().nullable(),
  prix: z.coerce.number().nonnegative().max(100000).optional().nullable(),
  taille: z.string().trim().max(30).optional().nullable(),
  statut: z.enum(LISTING_STATUSES).default('Available'),
  electromenagers: z.string().max(1000).optional().nullable(),
  code_entree: z.string().max(200).optional().nullable(),
  concierge_tel: z.string().max(50).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  source: z.string().trim().min(1).max(50).default('manual'),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
}).strict();

export const updateListingSchema = createListingSchema.partial();

export const assignLeadSchema = z.object({
  agentId: z.string().uuid(),
}).strict();

export const updateLeadProgressSchema = z.object({
  traitementStatut: z.enum(TRAITEMENT_STATUTS),
}).strict();

export const createCommentSchema = z.object({
  texte: z.string().trim().min(1).max(5000),
}).strict();

export const createUserSchema = z.object({
  nom: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  telephone: z.union([z.string().trim().min(6).max(30), z.literal('')]).optional(),
  password: passwordSchema,
  role: z.enum(USER_ROLES),
}).strict();

export const updateUserSchema = z.object({
  nom: z.string().trim().min(1).max(120).optional(),
  role: z.enum(USER_ROLES).optional(),
  actif: z.boolean().optional(),
}).strict();

export const updateUserReferralSlugSchema = z.object({
  referralSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(REFERRAL_USERNAME_MIN_LENGTH, `Min. ${REFERRAL_USERNAME_MIN_LENGTH} caractères`)
    .max(REFERRAL_USERNAME_MAX_LENGTH, `Max. ${REFERRAL_USERNAME_MAX_LENGTH} caractères`)
    .regex(REFERRAL_USERNAME_PATTERN, 'Lettres et chiffres seulement (a-z, 0-9)'),
}).strict();

const targetedSensitiveActions = new Set([
  'user.update',
  'user.deactivate',
  'user.reactivate',
  'user.delete',
  'listing.delete',
  'lead.delete',
  'media.delete',
  'comment.delete',
]);

export const actionTokenRequestSchema = z.object({
  action: z.enum(SENSITIVE_ACTIONS),
  targetId: z.string().uuid().optional(),
}).strict().superRefine((value, ctx) => {
  if (targetedSensitiveActions.has(value.action) && !value.targetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['targetId'],
      message: 'targetId requis pour cette action',
    });
  }
  if (!targetedSensitiveActions.has(value.action) && value.targetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['targetId'],
      message: 'targetId non autorisé pour cette action',
    });
  }
});

export const requestMediaUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  sizeBytes: z.coerce.number().int().positive().max(MAX_VIDEO_SIZE_MB * 1024 * 1024),
  type: z.enum(['image', 'video']),
  durationSeconds: z.coerce.number().positive().optional(),
}).strict().superRefine((data, ctx) => {
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
  reason: z.string().max(1000).optional(),
}).strict();

export const rejectMediaSchema = z.object({
  reason: z.string().max(1000).optional(),
}).strict();

export const reorderListingMediaSchema = z.object({
  mediaIds: z.array(z.string().uuid()).min(1).max(11),
}).strict();

export const updateProfileSchema = z.object({
  nom: z.string().trim().min(1).max(120).optional(),
  telephone: z.string().trim().min(6).max(30).nullable().optional(),
  profilePhotoMediaId: z.string().uuid().nullable().optional(),
}).strict();

export const agentProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().trim().email().max(320),
  nom: z.string().trim().min(1).max(120),
  telephone: z.string().trim().max(30).nullable(),
  role: z.enum(USER_ROLES),
  actif: z.boolean(),
  must_change_password: z.boolean(),
  referral_slug: z.string().trim().min(1).max(REFERRAL_USERNAME_MAX_LENGTH),
}).strict();

/** Columns safe to expose on authenticated /api/me profile responses. */
export const AGENT_PROFILE_SELECT = [
  'id',
  'email',
  'nom',
  'telephone',
  'role',
  'actif',
  'must_change_password',
  'referral_slug',
].join(',');

export function toAgentProfile(row: Record<string, unknown>) {
  const picked = {
    id: row.id,
    email: row.email,
    nom: row.nom,
    telephone: row.telephone ?? null,
    role: row.role,
    actif: row.actif,
    must_change_password: row.must_change_password,
    referral_slug: row.referral_slug,
  };
  const parsed = agentProfileSchema.safeParse(picked);
  if (!parsed.success) {
    throw new Error('Invalid agent profile row');
  }
  return parsed.data;
}

export const adminUserSchema = z.object({
  id: z.string().uuid(),
  nom: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  role: z.enum(USER_ROLES),
  actif: z.boolean(),
  referral_slug: z.string().trim().min(1).max(REFERRAL_USERNAME_MAX_LENGTH),
}).strict();

export const listingDetailSchema = z.object({
  adresse: z.string().trim().min(1).max(500),
  quartier: z.string().trim().max(120).nullable().optional(),
  prix: z.coerce.number().nonnegative().max(100000).nullable().optional(),
  taille: z.string().trim().max(30).nullable().optional(),
  statut: z.enum(LISTING_STATUSES),
  electromenagers: z.string().max(1000).nullable().optional(),
  code_entree: z.string().max(200).nullable().optional(),
  concierge_tel: z.string().max(50).nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  geocoding_status: z.enum(['pending', 'success', 'failed', 'manual']).nullable().optional(),
  geocoding_error: z.string().max(500).nullable().optional(),
}).strict();

export const uuidParamSchema = z.string().uuid();

export const loginEmailSchema = z.string().trim().email('Email invalide').max(320);

export const profilePhotoUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum(IMAGE_MIME_TYPES),
  sizeBytes: z.coerce.number().int().positive().max(MAX_IMAGE_SIZE_MB * 1024 * 1024),
}).strict();

export const createRentalSchema = z.object({
  listingId: z.string().uuid(),
  leadId: z.string().uuid().optional().nullable(),
  agentId: z.string().uuid().optional(),
  monthlyRent: z.coerce.number().nonnegative().max(100000).optional().nullable(),
  rentedAt: z.string().max(50).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
}).strict();

export const adminTestEmailSchema = z.object({
  to: z.string().trim().email().max(320).optional(),
}).strict();

const optionalQueryEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.enum(values).optional(),
  );

export const listingsQuerySchema = z.object({
  q: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.string().trim().min(2, 'Recherche trop courte').max(120).optional(),
  ),
  quartier: z.string().trim().max(120).optional(),
  statut: optionalQueryEnum(LISTING_STATUSES),
  taille: optionalQueryEnum(LISTING_SIZE_VALUES),
  source: optionalQueryEnum(LISTING_FILTER_SOURCES),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

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
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

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
