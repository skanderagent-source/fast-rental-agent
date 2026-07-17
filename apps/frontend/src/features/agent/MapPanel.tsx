import { useMemo } from 'react';
import { useMatch } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import { useQuery } from '@tanstack/react-query';
import {
  MAX_MAP_LISTINGS,
  areaCoordsKey,
  resolveAreaCoords,
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

function markerFillColor(listings: MapListing[]) {
  const statuses = new Set(listings.map((listing) => listing.statut));
  if (statuses.size === 1) {
    return colors[listings[0]!.statut] ?? '#6e6e73';
  }
  return '#0a84ff';
}

function markerGroup(listing: MapListing): { key: string; coords: [number, number]; approximate: boolean } | null {
  if (listing.latitude != null && listing.longitude != null) {
    if (listing.geocoding_status === 'approximate') {
      const areaKey = areaCoordsKey(listing.quartier);
      const areaCoords = resolveAreaCoords(listing.quartier);
      if (areaKey && areaCoords) {
        return { key: `area:${areaKey}`, coords: areaCoords, approximate: true };
      }
    }

    return {
      key: `exact:${listing.latitude.toFixed(6)}:${listing.longitude.toFixed(6)}`,
      coords: [listing.latitude, listing.longitude],
      approximate: false,
    };
  }

  const coords = resolveAreaCoords(listing.quartier);
  const key = areaCoordsKey(listing.quartier);
  if (!coords || !key) return null;

  return { key: `area:${key}`, coords, approximate: true };
}

function buildMapMarkers(listings: MapListing[]) {
  const markers = new Map<string, MapMarker>();
  let unlocated = 0;

  for (const listing of listings) {
    const group = markerGroup(listing);
    if (!group) {
      unlocated++;
      continue;
    }

    const existing = markers.get(group.key);
    if (existing) {
      existing.listings.push(listing);
      continue;
    }

    markers.set(group.key, {
      listings: [listing],
      coords: group.coords,
      approximate: group.approximate,
    });
  }

  return { markers: [...markers.values()], unlocatedCount: unlocated };
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

  const { markers, unlocatedCount } = useMemo(
    () => buildMapMarkers(data?.items ?? []),
    [data?.items],
  );

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
                const first = listings[0]!;
                const fillColor = markerFillColor(listings);
                const count = listings.length;
                return (
                  <CircleMarker
                    key={`${first.id}:${coords[0]}:${coords[1]}`}
                    center={coords}
                    radius={Math.min(16, 10 + Math.log2(Math.max(count, 1)))}
                    pathOptions={{
                      color: '#fff',
                      weight: 2,
                      fillColor,
                      fillOpacity: approximate ? 0.55 : 0.9,
                    }}
                  >
                    {count > 1 && (
                      <Tooltip
                        permanent
                        direction="center"
                        offset={[0, 0]}
                        className="map-marker-count"
                      >
                        {count}
                      </Tooltip>
                    )}
                    <Popup>
                      {count > 1 && (
                        <>
                          <b>{count} logements {approximate ? 'dans ce secteur' : 'à cette position'}</b>
                          <hr />
                        </>
                      )}
                      {listings.map((listing) => (
                        <div key={listing.id}>
                          <b>{esc(listing.adresse)}</b><br />
                          {approximate && listing.quartier && (
                            <>
                              <small>Secteur : {esc(listing.quartier)}</small><br />
                            </>
                          )}
                          {approximate && (
                            <>
                              <small>Position approximative (secteur)</small><br />
                            </>
                          )}
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
        <Legend color="#6e6e73" label="Position approximative (secteur)" opacity={0.55} />
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
