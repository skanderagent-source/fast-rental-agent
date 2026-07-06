import { z } from 'zod';
import {
  IMAGE_MIME_TYPES,
  LISTING_STATUSES,
  MAX_IMAGE_SIZE_MB,
  MAX_VIDEO_SIZE_MB,
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

export const createLeadSchema = z.object({
  listingId: z.string().uuid().optional().nullable(),
  nom: z.string().min(1),
  telephone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  revenuMensuel: z.coerce.number().optional().nullable(),
  scoreCredit: z.coerce.number().optional().nullable(),
  dateDemenagement: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  typeDemande: z.enum(['rappel', 'prequal']).default('rappel'),
  refAgentId: z.string().uuid().optional().nullable(),
});

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
  password: z.string().min(6),
  role: z.enum(USER_ROLES),
});

export const updateUserSchema = z.object({
  nom: z.string().min(1).optional(),
  role: z.enum(USER_ROLES).optional(),
  actif: z.boolean().optional(),
});

export const requestMediaUploadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.coerce.number().positive(),
  type: z.enum(['image', 'video']),
});

export const approveMediaSchema = z.object({
  reason: z.string().optional(),
});

export const rejectMediaSchema = z.object({
  reason: z.string().optional(),
});

export const updateProfileSchema = z.object({
  nom: z.string().min(1).optional(),
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
  pageSize: z.coerce.number().min(1).max(100).default(50),
});

export const leadsQuerySchema = z.object({
  includeArchived: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true'),
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
