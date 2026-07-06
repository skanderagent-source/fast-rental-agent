import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../db/supabaseAdmin.js';

let lastGeocodeAt = 0;

export async function geocodeListing(listingId: string) {
  const { data: listing, error } = await supabaseAdmin
    .from('logements')
    .select('*')
    .eq('id', listingId)
    .single();
  if (error || !listing) return;
  if (listing.latitude && listing.longitude) return;

  const query = `${listing.adresse}${listing.quartier ? `, ${listing.quartier}` : ''}, Québec, Canada`;
  const normalized = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

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
    return;
  }

  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastGeocodeAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGeocodeAt = Date.now();

  try {
    const url = new URL(env.GEOCODING_BASE_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    const res = await fetch(url, { headers: { 'User-Agent': env.GEOCODING_USER_AGENT } });
    const json = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!json.length) throw new Error('No results');
    const lat = parseFloat(json[0].lat);
    const lon = parseFloat(json[0].lon);
    await supabaseAdmin.from('geocode_cache').upsert({
      normalized_address: normalized,
      latitude: lat,
      longitude: lon,
      provider: env.GEOCODING_PROVIDER,
      raw_response: json[0] as unknown as Record<string, unknown>,
    });
    await supabaseAdmin.from('logements').update({
      latitude: lat,
      longitude: lon,
      geocoded_at: new Date().toISOString(),
      geocoding_status: 'success',
      geocoding_error: null,
    }).eq('id', listingId);
  } catch (err) {
    await supabaseAdmin.from('logements').update({
      geocoding_status: 'failed',
      geocoding_error: err instanceof Error ? err.message : 'Geocoding failed',
    }).eq('id', listingId);
  }
}
