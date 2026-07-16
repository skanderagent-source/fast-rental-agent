import { useMemo } from 'react';
import { useMatch } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { useQuery } from '@tanstack/react-query';
import {
  MAX_MAP_LISTINGS,
  QUARTIER_COORDS,
  type MapListing,
  type MapListingsResponse,
} from '@fast-rental/shared';
import { api } from '../../lib/apiClient';
import { esc, formatPrice } from '../../lib/format';

const colors: Record<string, string> = {
  Available: '#30d158',
  'On Hold': '#ffd60a',
  'Not Available': '#ff453a',
  'In Reno': '#6e6e73',
  Rented: '#bf5af2',
};

type MapMarker = {
  listings: MapListing[];
  coords: [number, number];
  approximate: boolean;
};

function normalizeQuartier(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const normalizedQuartierCoords = Object.entries(QUARTIER_COORDS).map(([quartier, coords]) => ({
  quartier: normalizeQuartier(quartier),
  coords,
}));

function lookupQuartierCoords(quartier: string | null) {
  const normalized = normalizeQuartier(quartier ?? '');
  if (!normalized) return null;

  const exact = normalizedQuartierCoords.find((entry) => entry.quartier === normalized);
  return exact?.coords ?? null;
}

export function MapPanel() {
  const active = useMatch('/app/map');
  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ['listings-map'],
    queryFn: () => api.get<MapListingsResponse>('/api/listings/map'),
    enabled: !!active,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const { markers, unlocatedCount } = useMemo(() => {
    const exactMarkers = new Map<string, MapMarker>();
    const approximateMarkers = new Map<string, MapMarker>();
    let unlocated = 0;

    for (const listing of data?.items ?? []) {
      if (listing.latitude != null && listing.longitude != null) {
        const key = `${listing.latitude}:${listing.longitude}`;
        const existing = exactMarkers.get(key);
        if (existing) {
          existing.listings.push(listing);
        } else {
          exactMarkers.set(key, {
            listings: [listing],
            coords: [listing.latitude, listing.longitude],
            approximate: false,
          });
        }
        continue;
      }

      const fallback = lookupQuartierCoords(listing.quartier);
      if (fallback) {
        const key = `${fallback[0]}:${fallback[1]}`;
        const existing = approximateMarkers.get(key);
        if (existing) {
          existing.listings.push(listing);
        } else {
          approximateMarkers.set(key, {
            listings: [listing],
            coords: fallback,
            approximate: true,
          });
        }
      } else {
        unlocated++;
      }
    }

    return {
      markers: [...exactMarkers.values(), ...approximateMarkers.values()],
      unlocatedCount: unlocated,
    };
  }, [data?.items]);

  return (
    <div className="panel-scroll map-panel">
      <div id="map-container" style={{ minHeight: active ? 320 : 0 }}>
        {active && (
          isLoading ? (
            <div className="empty">Chargement de la carte…</div>
          ) : isError ? (
            <div className="empty">
              <div>Impossible de charger la carte.</div>
              <button className="btn-secondary" onClick={() => void refetch()}>Réessayer</button>
            </div>
          ) : (
            <MapContainer
              center={[45.52, -73.6]}
              zoom={11}
              preferCanvas
              style={{ height: '100%', width: '100%', minHeight: 320 }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="© OSM"
                updateWhenIdle
              />
              {markers.map(({ listings, coords, approximate }) => {
                const statuses = new Set(listings.map((listing) => listing.statut));
                const first = listings[0]!;
                return (
                  <CircleMarker
                    key={first.id}
                    center={coords}
                    radius={Math.min(11, 7 + Math.log2(listings.length))}
                    pathOptions={{
                      color: '#fff',
                      weight: 2,
                      fillColor: statuses.size === 1
                        ? (colors[first.statut] ?? '#6e6e73')
                        : '#0a84ff',
                      fillOpacity: approximate ? 0.45 : 0.9,
                    }}
                  >
                    <Popup>
                      {listings.length > 1 && (
                        <><b>{listings.length} logements à cette position</b><hr /></>
                      )}
                      {listings.map((listing) => (
                        <div key={listing.id}>
                          <b>{esc(listing.adresse)}</b><br />
                          {approximate && <><small>Position approximative</small><br /></>}
                          {formatPrice(listing.prix)}
                        </div>
                      ))}
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          )
        )}
      </div>
      {active && data?.truncated && (
        <div className="map-panel__notice">
          La carte affiche les {MAX_MAP_LISTINGS.toLocaleString('fr-CA')} premiers logements sur {data.total.toLocaleString('fr-CA')}.
        </div>
      )}
      {active && unlocatedCount > 0 && (
        <div className="map-panel__notice">
          {unlocatedCount} logement{unlocatedCount > 1 ? 's' : ''} sans position affichable sur la carte.
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
        <Legend color="#30d158" label="Disponible" />
        <Legend color="#ffd60a" label="En attente" />
        <Legend color="#ff453a" label="Non dispo" />
        <Legend color="#6e6e73" label="Rénovation" />
        <Legend color="#bf5af2" label="Loué" />
        <Legend color="#0a84ff" label="Plusieurs statuts" />
        <Legend color="#6e6e73" label="Position approximative" opacity={0.45} />
      </div>
    </div>
  );
}

function Legend({ color, label, opacity }: { color: string; label: string; opacity?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, opacity: opacity ?? 1 }} />
      {label}
    </div>
  );
}
