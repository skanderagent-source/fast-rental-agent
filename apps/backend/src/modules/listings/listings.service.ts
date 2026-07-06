import {
  MAX_IMAGES_PER_LISTING,
  MAX_VIDEOS_PER_LISTING,
  validateMediaMime,
} from '@fast-rental/shared';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../db/supabaseAdmin.js';
import { getPagination } from '../../utils/pagination.js';
import { slugifyAddress, safeFilename } from '../../utils/slug.js';
import { createDownloadUrl, createUploadUrl, deleteObject, objectExists } from '../media/r2.service.js';
import { logActivity } from '../activity/activity.service.js';
import { emailService } from '../email/email.service.js';
import { geocodeListing } from './listings.geocode.js';
import { sortListingsByPhotos } from './listings.repository.js';
import { conflict, forbidden, notFound } from '../../utils/httpErrors.js';

const PUBLIC_FIELDS = [
  'id', 'adresse', 'quartier', 'prix', 'taille', 'statut', 'electromenagers',
  'latitude', 'longitude', 'approved_media_count', 'approved_image_count',
];

function pickPublic(listing: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_FIELDS) {
    if (listing[key] !== undefined) out[key] = listing[key];
  }
  return out;
}

export async function listListings(query: {
  q?: string;
  quartier?: string;
  statut?: string;
  taille?: string;
  source?: string;
  page: number;
  pageSize: number;
}, publicSafe = false) {
  const { from, to } = getPagination(query.page, query.pageSize);

  let dbQuery = supabaseAdmin
    .from('logements')
    .select('*', { count: 'exact' })
    .is('deleted_at', null);

  if (query.q) {
    dbQuery = dbQuery.or(`adresse.ilike.%${query.q}%,quartier.ilike.%${query.q}%`);
  }
  if (query.quartier) dbQuery = dbQuery.eq('quartier', query.quartier);
  if (query.statut) dbQuery = dbQuery.eq('statut', query.statut);
  if (query.taille) dbQuery = dbQuery.eq('taille', query.taille);
  if (query.source) {
    const sourceAliases: Record<string, string[]> = {
      'Fast Rental': ['Fast Rental', 'fast_rental'],
      Orcha: ['Orcha', 'orcha'],
      manual: ['manual'],
    };
    const sources = sourceAliases[query.source] ?? [query.source];
    dbQuery = sources.length === 1 ? dbQuery.eq('source', sources[0]!) : dbQuery.in('source', sources);
  }

  const { data: allRows, error, count } = await dbQuery;
  if (error) throw error;

  const { data: countRows } = await supabaseAdmin.from('listing_media_counts').select('*');
  const countMap = new Map((countRows ?? []).map((c) => [c.listing_id, c]));

  const sorted = sortListingsByPhotos(
    (allRows ?? []).map((row) => {
      const counts = countMap.get(row.id);
      return {
        ...row,
        approved_media_count: counts?.approved_media_count ?? 0,
        approved_image_count: counts?.approved_image_count ?? 0,
        pending_media_count: counts?.pending_media_count ?? 0,
      };
    }),
  );

  const pageItems = sorted.slice(from, to + 1).map((item) => {
    if (publicSafe) return pickPublic(item as Record<string, unknown>);
    return item;
  });

  const filtered = sorted;
  const available = filtered.filter((d) => d.statut === 'Available').length;
  const onHold = filtered.filter((d) => d.statut === 'On Hold').length;
  const priced = filtered.filter((d) => d.prix);
  const averagePrice = priced.length
    ? priced.reduce((s, d) => s + Number(d.prix), 0) / priced.length
    : null;

  return {
    items: pageItems,
    page: query.page,
    pageSize: query.pageSize,
    total: count ?? sorted.length,
    summary: { total: filtered.length, available, onHold, averagePrice },
  };
}

export async function getListing(id: string, publicSafe = false) {
  const { data, error } = await supabaseAdmin
    .from('logements')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (error || !data) throw notFound('Logement introuvable');
  if (publicSafe) return pickPublic(data as Record<string, unknown>);
  return data;
}

export async function createListing(input: Record<string, unknown>, createdBy: string) {
  const slug = slugifyAddress(String(input.adresse));
  const payload = {
    ...input,
    source: input.source ?? 'manual',
    sheet_row_id: `${slug}|manual`,
    created_by: createdBy,
    geocoding_status: input.latitude && input.longitude ? 'manual' : 'pending',
  };
  const { data, error } = await supabaseAdmin.from('logements').insert(payload).select('*').single();
  if (error) {
    if (error.code === '23505') throw conflict('Cette adresse existe déjà');
    throw error;
  }
  if (!input.latitude || !input.longitude) {
    void geocodeListing(data.id);
  }
  return data;
}

export async function updateListing(id: string, input: Record<string, unknown>) {
  const existing = await getListing(id);
  const manualOverrides = { ...(existing.manual_overrides as Record<string, boolean> ?? {}) };
  for (const key of Object.keys(input)) {
    if (input[key] !== undefined) manualOverrides[key] = true;
  }
  const updates = {
    ...input,
    manual_overrides: manualOverrides,
    geocoding_status: input.latitude !== undefined || input.longitude !== undefined ? 'manual' : existing.geocoding_status,
  };
  const { data, error } = await supabaseAdmin.from('logements').update(updates).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function softDeleteListing(id: string) {
  const { data, error } = await supabaseAdmin
    .from('logements')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listListingMedia(listingId: string, approvedOnly = false) {
  let q = supabaseAdmin.from('listing_media').select('*').eq('listing_id', listingId).order('created_at');
  if (approvedOnly) q = q.eq('status', 'approved');
  const { data, error } = await q;
  if (error) throw error;
  const items = await Promise.all((data ?? []).map(async (m) => {
    if (m.upload_completed_at && (m.status === 'approved' || !approvedOnly)) {
      const viewUrl = await createDownloadUrl(m.object_key, m.original_filename, true);
      const thumbnailUrl = m.type === 'image' ? viewUrl : undefined;
      return { ...m, viewUrl, thumbnailUrl };
    }
    return m;
  }));
  return items;
}

export async function requestMediaUpload(
  listingId: string,
  userId: string,
  input: { filename: string; mimeType: string; sizeBytes: number; type: 'image' | 'video' },
) {
  const mimeError = validateMediaMime(input.type, input.mimeType, input.sizeBytes);
  if (mimeError) throw Object.assign(new Error(mimeError), { status: 400, code: 'VALIDATION_ERROR' });

  const objectKey = `listings/${listingId}/${randomUUID()}/${safeFilename(input.filename)}`;
  const { data: mediaId, error } = await supabaseAdmin.rpc('reserve_listing_media_upload', {
    p_listing_id: listingId,
    p_uploaded_by: userId,
    p_type: input.type,
    p_bucket: env.R2_BUCKET,
    p_object_key: objectKey,
    p_original_filename: input.filename,
    p_mime_type: input.mimeType,
    p_size_bytes: input.sizeBytes,
    p_max_images: MAX_IMAGES_PER_LISTING,
    p_max_videos: MAX_VIDEOS_PER_LISTING,
  });
  if (error) {
    if (error.message.includes('limit')) throw conflict(error.message);
    throw error;
  }
  const uploadUrl = await createUploadUrl(objectKey, input.mimeType);
  return { mediaId, uploadUrl, objectKey };
}

export async function completeMediaUpload(listingId: string, mediaId: string, userId: string) {
  const { data: media, error } = await supabaseAdmin
    .from('listing_media')
    .select('*')
    .eq('id', mediaId)
    .eq('listing_id', listingId)
    .single();
  if (error || !media) throw notFound('Média introuvable');
  if (media.uploaded_by !== userId) throw forbidden('Non autorisé');
  const exists = await objectExists(media.object_key);
  if (!exists) throw conflict('Upload introuvable dans R2', 'UPLOAD_NOT_FOUND');
  const { data, error: updateError } = await supabaseAdmin
    .from('listing_media')
    .update({ upload_completed_at: new Date().toISOString() })
    .eq('id', mediaId)
    .select('*')
    .single();
  if (updateError) throw updateError;
  await logActivity({
    agentId: userId,
    agentNom: '',
    typeAction: 'media_uploaded',
    details: `Média uploadé: ${media.original_filename}`,
    logementId: listingId,
  });
  return data;
}

export async function approveMedia(mediaId: string, adminId: string) {
  const { data, error } = await supabaseAdmin
    .from('listing_media')
    .update({
      status: 'approved',
      approved_by: adminId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', mediaId)
    .eq('status', 'pending')
    .not('upload_completed_at', 'is', null)
    .select('*, agents!listing_media_uploaded_by_fkey(email, nom)')
    .single();
  if (error) throw error;
  const uploader = (data as { agents?: { email?: string; nom?: string } }).agents;
  const { data: listing } = await supabaseAdmin.from('logements').select('adresse').eq('id', data.listing_id).maybeSingle();
  if (uploader?.email) {
    emailService.notifyMediaApproved(uploader.email, {
      agentNom: uploader.nom ?? 'Agent',
      originalFilename: data.original_filename,
      listingAdresse: listing?.adresse ?? 'Logement',
    });
  }
  return data;
}

export async function rejectMedia(mediaId: string, adminId: string, reason?: string) {
  const { data, error } = await supabaseAdmin
    .from('listing_media')
    .update({
      status: 'rejected',
      approved_by: adminId,
      rejection_reason: reason ?? null,
    })
    .eq('id', mediaId)
    .select('*, agents!listing_media_uploaded_by_fkey(email, nom)')
    .single();
  if (error) throw error;
  const uploader = (data as { agents?: { email?: string; nom?: string } }).agents;
  const { data: listing } = await supabaseAdmin.from('logements').select('adresse').eq('id', data.listing_id).maybeSingle();
  if (uploader?.email) {
    emailService.notifyMediaRejected(uploader.email, {
      agentNom: uploader.nom ?? 'Agent',
      originalFilename: data.original_filename,
      listingAdresse: listing?.adresse ?? 'Logement',
      reason,
    });
  }
  return data;
}

export async function getMediaDownloadUrl(mediaId: string, isAuthenticated = false) {
  const { data, error } = await supabaseAdmin.from('listing_media').select('*').eq('id', mediaId).single();
  if (error || !data) throw notFound('Média introuvable');
  if (!isAuthenticated && data.status !== 'approved') throw forbidden('Média non public');
  const url = await createDownloadUrl(data.object_key, data.original_filename);
  return { url, expiresInSeconds: env.R2_SIGNED_DOWNLOAD_EXPIRES_SECONDS };
}

export async function deleteMedia(mediaId: string, userId: string, isAdmin: boolean) {
  const { data, error } = await supabaseAdmin.from('listing_media').select('*').eq('id', mediaId).single();
  if (error || !data) throw notFound('Média introuvable');
  if (!isAdmin && (data.uploaded_by !== userId || data.status !== 'pending')) {
    throw forbidden('Non autorisé');
  }
  await deleteObject(data.object_key);
  await supabaseAdmin.from('listing_media').delete().eq('id', mediaId);
  return { deleted: true };
}

export async function requestProfilePhotoUpload(userId: string, input: { filename: string; mimeType: string; sizeBytes: number }) {
  const mimeError = validateMediaMime('image', input.mimeType, input.sizeBytes);
  if (mimeError) throw Object.assign(new Error(mimeError), { status: 400, code: 'VALIDATION_ERROR' });
  const objectKey = `profiles/${userId}/${randomUUID()}/${safeFilename(input.filename)}`;
  const { data, error } = await supabaseAdmin
    .from('user_media')
    .insert({
      user_id: userId,
      bucket: env.R2_BUCKET,
      object_key: objectKey,
      original_filename: input.filename,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
    })
    .select('*')
    .single();
  if (error) throw error;
  const uploadUrl = await createUploadUrl(objectKey, input.mimeType);
  return { mediaId: data.id, uploadUrl, objectKey };
}

export async function completeProfilePhoto(userId: string, mediaId: string) {
  const { data: media, error } = await supabaseAdmin
    .from('user_media')
    .select('*')
    .eq('id', mediaId)
    .eq('user_id', userId)
    .single();
  if (error || !media) throw notFound('Média introuvable');
  const exists = await objectExists(media.object_key);
  if (!exists) throw conflict('Upload introuvable', 'UPLOAD_NOT_FOUND');
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('agents')
    .update({ profile_photo_media_id: mediaId })
    .eq('id', userId)
    .select('*')
    .single();
  if (profileError) throw profileError;
  return profile;
}
