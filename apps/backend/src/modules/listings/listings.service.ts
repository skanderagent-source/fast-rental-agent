import {
  MAX_IMAGES_PER_LISTING,
  MAX_LISTING_SEARCH_ROWS,
  MAX_MAP_LISTINGS,
  MAX_VIDEOS_PER_LISTING,
  type MapListing,
  validateMediaMime,
  validateVideoDuration,
} from '@fast-rental/shared';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../db/supabaseAdmin.js';
import { getPagination } from '../../utils/pagination.js';
import { sanitizePostgrestSearchTerm } from '../../utils/postgrest.js';
import { slugifyAddress, safeFilename } from '../../utils/slug.js';
import {
  createDownloadUrl,
  createUploadUrl,
  deleteObject,
  isLocalStorage,
  objectExists,
  putObject,
  readObjectPrefix,
  readObjectSize,
} from '../media/storage.service.js';
import { validateMediaContentBuffer, validateMediaContentSize } from '../../utils/mediaContentInspection.js';
import { logActivity } from '../activity/activity.service.js';
import { emailService } from '../email/email.service.js';
import { geocodeListing } from './listings.geocode.js';
import { sortListingsByMedia } from './listings.repository.js';
import { conflict, forbidden, notFound } from '../../utils/httpErrors.js';

const PUBLIC_FIELDS = [
  'id', 'adresse', 'quartier', 'prix', 'taille', 'statut', 'electromenagers',
  'latitude', 'longitude', 'approved_media_count', 'approved_image_count',
];
const MAP_QUERY_PAGE_SIZE = 1000;
const ADDRESS_FIELDS = ['adresse', 'quartier'] as const;
const LISTING_WRITABLE_FIELDS = [
  'adresse',
  'quartier',
  'prix',
  'taille',
  'statut',
  'electromenagers',
  'code_entree',
  'concierge_tel',
  'notes',
  'source',
  'latitude',
  'longitude',
] as const;

function pickListingWrites(input: Record<string, unknown>) {
  const writable = Object.create(null) as Record<string, unknown>;
  for (const field of LISTING_WRITABLE_FIELDS) {
    if (input[field] !== undefined) writable[field] = input[field];
  }
  return writable;
}

function pickPublic(listing: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_FIELDS) {
    if (listing[key] !== undefined) out[key] = listing[key];
  }
  return out;
}

type CoverMediaRow = {
  listing_id: string;
  object_key: string;
  original_filename: string;
};

async function loadCoverImageUrls(listingIds: string[]): Promise<Map<string, string>> {
  if (!listingIds.length) return new Map();

  const { data, error } = await supabaseAdmin
    .from('listing_media')
    .select('listing_id, object_key, original_filename, sort_order, created_at')
    .in('listing_id', listingIds)
    .eq('status', 'approved')
    .eq('type', 'image')
    .not('upload_completed_at', 'is', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;

  const firstByListing = new Map<string, CoverMediaRow>();
  for (const row of (data ?? []) as CoverMediaRow[]) {
    if (!firstByListing.has(row.listing_id)) {
      firstByListing.set(row.listing_id, row);
    }
  }

  const entries = await Promise.all(
    [...firstByListing.entries()].map(async ([listingId, media]) => {
      const url = await createDownloadUrl(media.object_key, media.original_filename, true);
      return [listingId, url] as const;
    }),
  );
  return new Map(entries);
}

async function attachCoverImageUrls<T extends { id: string; approved_image_count?: number }>(
  items: T[],
): Promise<Array<T & { cover_image_url?: string }>> {
  const listingIds = items
    .filter((item) => (item.approved_image_count ?? 0) > 0)
    .map((item) => item.id);
  const coverUrls = await loadCoverImageUrls(listingIds);
  return items.map((item) => ({
    ...item,
    ...(coverUrls.has(item.id) ? { cover_image_url: coverUrls.get(item.id) } : {}),
  }));
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
    const safeQ = sanitizePostgrestSearchTerm(query.q);
    if (safeQ) {
      dbQuery = dbQuery.or(`adresse.ilike.%${safeQ}%,quartier.ilike.%${safeQ}%`);
    }
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

  const { data: allRows, error, count } = await dbQuery.limit(MAX_LISTING_SEARCH_ROWS);
  if (error) throw error;

  const totalMatches = count ?? allRows?.length ?? 0;
  const truncated = totalMatches > MAX_LISTING_SEARCH_ROWS;

  const { data: countRows } = await supabaseAdmin.from('listing_media_counts').select('*');
  const countMap = new Map((countRows ?? []).map((c) => [c.listing_id, c]));

  const sorted = sortListingsByMedia(
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
  const items = await attachCoverImageUrls(pageItems);

  const filtered = sorted;
  const available = filtered.filter((d) => d.statut === 'Available').length;
  const onHold = filtered.filter((d) => d.statut === 'On Hold').length;
  const priced = filtered.filter((d) => d.prix);
  const averagePrice = priced.length
    ? priced.reduce((s, d) => s + Number(d.prix), 0) / priced.length
    : null;

  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total: truncated ? MAX_LISTING_SEARCH_ROWS : (count ?? sorted.length),
    truncated,
    summary: { total: filtered.length, available, onHold, averagePrice },
  };
}

export async function listMapListings() {
  const mapFields = 'id,adresse,quartier,prix,statut,latitude,longitude,geocoding_status';
  const firstTo = Math.min(MAP_QUERY_PAGE_SIZE, MAX_MAP_LISTINGS) - 1;
  const {
    data: firstPage,
    error: firstPageError,
    count,
  } = await supabaseAdmin
    .from('logements')
    .select(mapFields, { count: 'exact' })
    .is('deleted_at', null)
    .order('adresse', { ascending: true })
    .order('id', { ascending: true })
    .range(0, firstTo);
  if (firstPageError) throw firstPageError;

  const total = count ?? firstPage?.length ?? 0;
  const itemCount = Math.min(total, MAX_MAP_LISTINGS);
  const ranges: Array<[number, number]> = [];
  for (let from = MAP_QUERY_PAGE_SIZE; from < itemCount; from += MAP_QUERY_PAGE_SIZE) {
    ranges.push([from, Math.min(from + MAP_QUERY_PAGE_SIZE - 1, itemCount - 1)]);
  }

  const remainingPages = await Promise.all(ranges.map(async ([from, to]) => {
    const { data, error } = await supabaseAdmin
      .from('logements')
      .select(mapFields)
      .is('deleted_at', null)
      .order('adresse', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to);
    if (error) throw error;
    return (data ?? []) as MapListing[];
  }));

  const items = [
    ...((firstPage ?? []) as MapListing[]),
    ...remainingPages.flat(),
  ].slice(0, MAX_MAP_LISTINGS);

  return {
    items,
    total,
    truncated: total > MAX_MAP_LISTINGS,
  };
}

export async function listUserMedia(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('listing_media')
    .select('*, logements!inner(id,adresse,deleted_at)')
    .eq('uploaded_by', userId)
    .not('upload_completed_at', 'is', null)
    .is('logements.deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;

  const enriched = await Promise.all((data ?? []).map(async (row) => {
    const listingRelation = row.logements as
      | { id?: string; adresse?: string }
      | Array<{ id?: string; adresse?: string }>
      | null;
    const listing = Array.isArray(listingRelation) ? listingRelation[0] : listingRelation;
    const media = { ...row };
    delete media.logements;
    const viewUrl = await createDownloadUrl(media.object_key, media.original_filename, true);
    return {
      listingId: listing?.id ?? media.listing_id,
      adresse: listing?.adresse ?? 'Logement',
      media: {
        ...media,
        viewUrl,
        thumbnailUrl: media.type === 'image' ? viewUrl : undefined,
      },
    };
  }));

  const groups = new Map<string, {
    listingId: string;
    adresse: string;
    media: Array<Record<string, unknown>>;
  }>();
  for (const item of enriched) {
    let group = groups.get(item.listingId);
    if (!group) {
      group = {
        listingId: item.listingId,
        adresse: item.adresse,
        media: [],
      };
      groups.set(item.listingId, group);
    }
    group.media.push(item.media);
  }

  return [...groups.values()].sort((a, b) => a.adresse.localeCompare(b.adresse, 'fr'));
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
  const writable = pickListingWrites(input);
  const slug = slugifyAddress(String(writable.adresse));
  const payload = {
    ...writable,
    source: writable.source ?? 'manual',
    sheet_row_id: `${slug}|manual`,
    created_by: createdBy,
    geocoding_status: writable.latitude != null && writable.longitude != null ? 'manual' : 'pending',
  };
  const { data, error } = await supabaseAdmin.from('logements').insert(payload).select('*').single();
  if (error) {
    if (error.code === '23505') throw conflict('Cette adresse existe déjà');
    throw error;
  }
  if (writable.latitude == null || writable.longitude == null) {
    void geocodeListing(data.id);
  }
  return data;
}

export async function updateListing(id: string, input: Record<string, unknown>) {
  const writable = pickListingWrites(input);
  const existing = await getListing(id);
  const manualOverrides = { ...(existing.manual_overrides as Record<string, boolean> ?? {}) };
  for (const key of Object.keys(writable)) {
    if (writable[key] !== undefined) manualOverrides[key] = true;
  }
  const addressChanged = ADDRESS_FIELDS.some(
    (field) => writable[field] !== undefined && writable[field] !== existing[field],
  );
  const coordinatesChanged = ['latitude', 'longitude'].some(
    (field) => writable[field] !== undefined && writable[field] !== existing[field],
  );
  const hasCompleteCoordinates = writable.latitude != null && writable.longitude != null;
  const shouldClearCoordinates = coordinatesChanged && !hasCompleteCoordinates;
  const needsGeocode = (addressChanged && !(coordinatesChanged && hasCompleteCoordinates))
    || shouldClearCoordinates;
  const updates = {
    ...writable,
    manual_overrides: manualOverrides,
    ...(needsGeocode
      ? {
        ...(shouldClearCoordinates ? { latitude: null, longitude: null } : {}),
        geocoded_at: null,
        geocoding_status: 'pending',
        geocoding_error: null,
      }
      : {
        geocoding_status: coordinatesChanged && hasCompleteCoordinates
          ? 'manual'
          : existing.geocoding_status,
      }),
  };
  const { data, error } = await supabaseAdmin.from('logements').update(updates).eq('id', id).select('*').single();
  if (error) throw error;
  if (needsGeocode) void geocodeListing(data.id);
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
  let q = supabaseAdmin.from('listing_media').select('*').eq('listing_id', listingId).order('sort_order').order('created_at');
  if (approvedOnly) q = q.eq('status', 'approved');
  const { data, error } = await q;
  if (error) throw error;
  const items = await Promise.all((data ?? []).map(async (m) => {
    if (m.upload_completed_at && (m.status === 'approved' || m.status === 'pending' || !approvedOnly)) {
      const viewUrl = await createDownloadUrl(m.object_key, m.original_filename, true);
      const thumbnailUrl = m.type === 'image' ? viewUrl : undefined;
      return { ...m, viewUrl, thumbnailUrl };
    }
    return m;
  }));
  return items;
}

async function inspectStoredMedia(
  objectKey: string,
  mimeType: string,
  declaredSizeBytes: number,
): Promise<string | null> {
  const actualSize = await readObjectSize(objectKey);
  const sizeError = validateMediaContentSize(actualSize, declaredSizeBytes);
  if (sizeError) return sizeError;

  const prefix = await readObjectPrefix(objectKey);
  return validateMediaContentBuffer(prefix, mimeType, declaredSizeBytes);
}

async function rejectInvalidStoredMedia(objectKey: string, message: string): Promise<never> {
  try {
    await deleteObject(objectKey);
  } catch {
    /* best-effort cleanup */
  }
  throw Object.assign(new Error(message), { status: 400, code: 'VALIDATION_ERROR' });
}

export async function requestMediaUpload(
  listingId: string,
  userId: string,
  input: {
    filename: string;
    mimeType: string;
    sizeBytes: number;
    type: 'image' | 'video';
    durationSeconds?: number;
  },
) {
  const mimeError = validateMediaMime(input.type, input.mimeType, input.sizeBytes);
  if (mimeError) throw Object.assign(new Error(mimeError), { status: 400, code: 'VALIDATION_ERROR' });

  if (input.type === 'video') {
    const durationError = validateVideoDuration(input.durationSeconds ?? Number.NaN);
    if (durationError) throw Object.assign(new Error(durationError), { status: 400, code: 'VALIDATION_ERROR' });
  }

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

  if (input.type === 'video' && input.durationSeconds != null) {
    const { error: durationError } = await supabaseAdmin
      .from('listing_media')
      .update({ duration_seconds: input.durationSeconds })
      .eq('id', mediaId);
    if (durationError) throw durationError;
  }
  const uploadUrl = await createUploadUrl(objectKey, input.mimeType);
  return {
    mediaId,
    uploadUrl,
    objectKey,
    uploadMode: isLocalStorage() ? 'proxy' : 'signed',
  };
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
  const contentError = await inspectStoredMedia(media.object_key, media.mime_type, media.size_bytes);
  if (contentError) {
    await rejectInvalidStoredMedia(media.object_key, contentError);
  }
  const now = new Date().toISOString();
  const { data, error: updateError } = await supabaseAdmin
    .from('listing_media')
    .update({
      upload_completed_at: now,
      status: 'approved',
      approved_at: now,
      approved_by: userId,
    })
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

export async function uploadMediaFile(listingId: string, mediaId: string, userId: string, body: Buffer) {
  const { data: media, error } = await supabaseAdmin
    .from('listing_media')
    .select('*')
    .eq('id', mediaId)
    .eq('listing_id', listingId)
    .single();
  if (error || !media) throw notFound('Média introuvable');
  if (media.uploaded_by !== userId) throw forbidden('Non autorisé');
  if (media.upload_completed_at) throw conflict('Média déjà uploadé');
  const contentError = validateMediaContentBuffer(body, media.mime_type, media.size_bytes);
  if (contentError) {
    throw Object.assign(new Error(contentError), { status: 400, code: 'VALIDATION_ERROR' });
  }
  await putObject(media.object_key, body, media.mime_type);
  return completeMediaUpload(listingId, mediaId, userId);
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
  if (!isAdmin && data.uploaded_by !== userId) {
    throw forbidden('Non autorisé');
  }
  await deleteObject(data.object_key);
  await supabaseAdmin.from('listing_media').delete().eq('id', mediaId);
  return { deleted: true };
}

export async function reorderListingMedia(
  listingId: string,
  mediaIds: string[],
  userId: string,
  isAdmin: boolean,
) {
  await getListing(listingId);

  const { data: existing, error } = await supabaseAdmin
    .from('listing_media')
    .select('id, uploaded_by, sort_order')
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: true });
  if (error) throw error;

  const rows = existing ?? [];
  const existingIds = new Set(rows.map((row) => row.id));
  if (mediaIds.length !== existingIds.size) {
    throw Object.assign(new Error('La liste de médias est incomplète ou invalide'), { status: 400, code: 'VALIDATION_ERROR' });
  }
  for (const id of mediaIds) {
    if (!existingIds.has(id)) {
      throw Object.assign(new Error('Média introuvable pour ce logement'), { status: 400, code: 'VALIDATION_ERROR' });
    }
  }

  if (!isAdmin) {
    const oldIds = rows.map((row) => row.id);
    const changedIds = new Set<string>();
    for (let i = 0; i < mediaIds.length; i++) {
      if (mediaIds[i] !== oldIds[i]) {
        changedIds.add(mediaIds[i]!);
        changedIds.add(oldIds[i]!);
      }
    }
    for (const id of changedIds) {
      const row = rows.find((item) => item.id === id);
      if (row && row.uploaded_by !== userId) {
        throw forbidden('Non autorisé');
      }
    }
  }

  const updates = mediaIds.map((id, index) =>
    supabaseAdmin.from('listing_media').update({ sort_order: index }).eq('id', id).eq('listing_id', listingId),
  );
  const results = await Promise.all(updates);
  for (const result of results) {
    if (result.error) throw result.error;
  }

  return listListingMedia(listingId, false);
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
  const contentError = await inspectStoredMedia(media.object_key, media.mime_type, media.size_bytes);
  if (contentError) {
    await rejectInvalidStoredMedia(media.object_key, contentError);
  }
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('agents')
    .update({ profile_photo_media_id: mediaId })
    .eq('id', userId)
    .select('*')
    .single();
  if (profileError) throw profileError;
  return profile;
}
