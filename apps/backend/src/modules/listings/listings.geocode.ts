import { resolveAreaCoords } from '@fast-rental/shared';
import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../db/supabaseAdmin.js';
import { logger } from '../../config/logger.js';
import { fetchAllowlisted, geocodingAllowedOrigin } from '../../utils/outboundFetch.js';
import {
  buildAreaGeocodeQuery,
  buildGeocodeQuery,
  normalizeGeocodeAddress,
} from './listings.geocode.helpers.js';

export { buildAreaGeocodeQuery, buildGeocodeQuery, normalizeGeocodeAddress } from './listings.geocode.helpers.js';

const MIN_DELAY_MS = 1100;

let lastGeocodeAt = 0;
let rateLimitChain: Promise<void> = Promise.resolve();

async function waitForRateLimitSlot() {
  let release!: () => void;
  const slot = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = rateLimitChain;
  rateLimitChain = slot;
  await previous;

  const now = Date.now();
  const wait = Math.max(0, MIN_DELAY_MS - (now - lastGeocodeAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGeocodeAt = Date.now();
  release();
}

async function fetchNominatimCoords(query: string) {
  await waitForRateLimitSlot();

  const url = new URL(env.GEOCODING_BASE_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'ca');

  const res = await fetchAllowlisted(url, geocodingAllowedOrigin(), {
    headers: {
      'User-Agent': env.GEOCODING_USER_AGENT,
      'Accept-Language': 'fr',
    },
  });

  if (!res.ok) {
    throw new Error(`Geocoding HTTP ${res.status}`);
  }

  const json = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!json.length) throw new Error('No results');

  return {
    lat: parseFloat(json[0].lat),
    lon: parseFloat(json[0].lon),
    raw: json[0] as unknown as Record<string, unknown>,
  };
}

async function applyGeocodeResult(
  listingId: string,
  normalized: string,
  lat: number,
  lon: number,
  raw: Record<string, unknown>,
  status: 'success' | 'approximate',
) {
  await supabaseAdmin.from('geocode_cache').upsert({
    normalized_address: normalized,
    latitude: lat,
    longitude: lon,
    provider: env.GEOCODING_PROVIDER,
    raw_response: raw,
  });

  await supabaseAdmin.from('logements').update({
    latitude: lat,
    longitude: lon,
    geocoded_at: new Date().toISOString(),
    geocoding_status: status,
    geocoding_error: null,
  }).eq('id', listingId);
}

async function applyCachedGeocode(
  listingId: string,
  lat: number,
  lon: number,
  status: 'success' | 'approximate',
) {
  await supabaseAdmin.from('logements').update({
    latitude: lat,
    longitude: lon,
    geocoded_at: new Date().toISOString(),
    geocoding_status: status,
    geocoding_error: null,
  }).eq('id', listingId);
}

async function geocodeFromCache(normalized: string, listingId: string, status: 'success' | 'approximate') {
  const { data: cached } = await supabaseAdmin
    .from('geocode_cache')
    .select('*')
    .eq('normalized_address', normalized)
    .maybeSingle();

  if (!cached) return false;

  await applyCachedGeocode(listingId, cached.latitude, cached.longitude, status);
  return true;
}

async function geocodeWithQuery(
  listingId: string,
  query: string,
  status: 'success' | 'approximate',
) {
  const normalized = normalizeGeocodeAddress(query);
  if (await geocodeFromCache(normalized, listingId, status)) {
    return status === 'approximate' ? 'approximate' : 'cached';
  }

  const result = await fetchNominatimCoords(query);
  await applyGeocodeResult(listingId, normalized, result.lat, result.lon, result.raw, status);
  return status === 'approximate' ? 'approximate' : 'success';
}

async function geocodeFromAreaLookup(
  listing: { id: string; quartier: string | null },
) {
  const coords = resolveAreaCoords(listing.quartier);
  if (!coords) return false;

  const normalized = normalizeGeocodeAddress(`area:${listing.quartier ?? ''}`);
  await applyGeocodeResult(
    listing.id,
    normalized,
    coords[0],
    coords[1],
    { source: 'area_lookup', area: listing.quartier },
    'approximate',
  );
  return true;
}

export async function geocodeListing(
  listingId: string,
  force = false,
): Promise<'success' | 'cached' | 'approximate' | 'skipped' | 'failed'> {
  const { data: listing, error } = await supabaseAdmin
    .from('logements')
    .select('id, adresse, quartier, ville, latitude, longitude, geocoding_status')
    .eq('id', listingId)
    .single();

  if (error || !listing) return 'skipped';
  if (
    !force
    && listing.geocoding_status !== 'pending'
    && listing.geocoding_status !== 'failed'
    && listing.latitude != null
    && listing.longitude != null
  ) return 'skipped';

  const addressQuery = buildGeocodeQuery(listing);
  const addressNormalized = normalizeGeocodeAddress(addressQuery);

  if (await geocodeFromCache(addressNormalized, listingId, 'success')) {
    return 'cached';
  }

  try {
    const result = await fetchNominatimCoords(addressQuery);
    await applyGeocodeResult(listingId, addressNormalized, result.lat, result.lon, result.raw, 'success');
    return 'success';
  } catch (addressError) {
    const areaQuery = buildAreaGeocodeQuery(listing);
    if (areaQuery) {
      try {
        return await geocodeWithQuery(listingId, areaQuery, 'approximate');
      } catch {
        // Fall through to static area lookup.
      }
    }

    if (await geocodeFromAreaLookup(listing)) {
      return 'approximate';
    }

    const message = addressError instanceof Error ? addressError.message : 'Geocoding failed';
    await supabaseAdmin.from('logements').update({
      geocoding_status: 'failed',
      geocoding_error: message,
    }).eq('id', listingId);
    return 'failed';
  }
}

export type GeocodeBatchResult = {
  total: number;
  success: number;
  cached: number;
  approximate: number;
  failed: number;
  skipped: number;
  estimatedMinutes: number;
};

/** Geocode queued listings sequentially (Nominatim-safe). */
export async function geocodeAllPendingListings(retryFailed = false): Promise<GeocodeBatchResult> {
  let query = supabaseAdmin
    .from('logements')
    .select('id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  query = retryFailed
    ? query.in('geocoding_status', ['pending', 'failed'])
    : query.eq('geocoding_status', 'pending');
  const { data, error } = await query;

  if (error) throw error;

  const listings = data ?? [];
  const result: GeocodeBatchResult = {
    total: listings.length,
    success: 0,
    cached: 0,
    approximate: 0,
    failed: 0,
    skipped: 0,
    estimatedMinutes: Math.ceil((listings.length * MIN_DELAY_MS) / 60_000),
  };

  logger.info(
    { total: result.total, estimatedMinutes: result.estimatedMinutes },
    'Batch geocoding started',
  );

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i]!;
    const status = await geocodeListing(listing.id, retryFailed);
    if (status === 'success') result.success++;
    else if (status === 'cached') result.cached++;
    else if (status === 'approximate') result.approximate++;
    else if (status === 'failed') result.failed++;
    else result.skipped++;

    if ((i + 1) % 25 === 0 || i === listings.length - 1) {
      logger.info(
        { progress: `${i + 1}/${listings.length}`, ...result },
        'Batch geocoding progress',
      );
    }
  }

  logger.info(result, 'Batch geocoding finished');
  return result;
}
