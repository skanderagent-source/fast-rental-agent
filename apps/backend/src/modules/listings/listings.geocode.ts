import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../db/supabaseAdmin.js';
import { logger } from '../../config/logger.js';
import { buildGeocodeQuery, normalizeGeocodeAddress } from './listings.geocode.helpers.js';

export { buildGeocodeQuery, normalizeGeocodeAddress } from './listings.geocode.helpers.js';

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

  const res = await fetch(url, {
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
    geocoding_status: 'success',
    geocoding_error: null,
  }).eq('id', listingId);
}

export async function geocodeListing(
  listingId: string,
  force = false,
): Promise<'success' | 'cached' | 'skipped' | 'failed'> {
  const { data: listing, error } = await supabaseAdmin
    .from('logements')
    .select('id, adresse, quartier, ville, latitude, longitude, geocoding_status')
    .eq('id', listingId)
    .single();

  if (error || !listing) return 'skipped';
  if (
    !force
    &&
    listing.geocoding_status !== 'pending'
    && listing.latitude != null
    && listing.longitude != null
  ) return 'skipped';

  const query = buildGeocodeQuery(listing);
  const normalized = normalizeGeocodeAddress(query);

  const { data: cached } = await supabaseAdmin
    .from('geocode_cache')
    .select('*')
    .eq('normalized_address', normalized)
    .maybeSingle();

  if (cached) {
    await supabaseAdmin.from('logements').update({
      latitude: cached.latitude,
      longitude: cached.longitude,
      geocoded_at: new Date().toISOString(),
      geocoding_status: 'success',
      geocoding_error: null,
    }).eq('id', listingId);
    return 'cached';
  }

  try {
    const result = await fetchNominatimCoords(query);
    await applyGeocodeResult(listingId, normalized, result.lat, result.lon, result.raw);
    return 'success';
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Geocoding failed';
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
