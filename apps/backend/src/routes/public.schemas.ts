import { z } from 'zod';

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().finite().nullable().optional();

export const publicListingResponseSchema = z.object({
  id: z.string().min(1).max(100),
  adresse: z.string().max(500),
  quartier: nullableString,
  prix: z.union([z.number().finite(), z.string().max(50)]).nullable().optional(),
  taille: nullableString,
  statut: z.string().max(50),
  electromenagers: nullableString,
  latitude: nullableNumber,
  longitude: nullableNumber,
  approved_media_count: z.number().int().nonnegative().optional(),
  approved_image_count: z.number().int().nonnegative().optional(),
}).strip();

const publicMediaResponseSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(['image', 'video']),
  original_filename: z.string().max(255).optional(),
  mime_type: z.string().max(100).optional(),
  size_bytes: z.number().int().nonnegative().optional(),
  duration_seconds: nullableNumber,
  sort_order: z.number().int().nonnegative().optional(),
  viewUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
}).strip();

export const publicListingsDataSchema = z.object({
  items: z.array(publicListingResponseSchema).max(100),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
  truncated: z.boolean(),
  summary: z.object({
    total: z.number().int().nonnegative(),
    available: z.number().int().nonnegative(),
    onHold: z.number().int().nonnegative(),
    averagePrice: nullableNumber,
  }).strip(),
}).strip();

export const publicListingDetailDataSchema = z.object({
  listing: publicListingResponseSchema,
  media: z.array(publicMediaResponseSchema).max(11),
}).strip();
