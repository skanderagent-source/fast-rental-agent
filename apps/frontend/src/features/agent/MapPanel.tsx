import { useEffect, useMemo } from 'react';
import { useMatch } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { useQuery } from '@tanstack/react-query';
import { QUARTIER_COORDS } from '@fast-rental/shared';
import { api } from '../../lib/apiClient';
import { esc, formatPrice } from '../../lib/format';
import type { Listing } from '@fast-rental/shared';

const colors: Record<string, string> = {
  Available: '#30d158',
  'On Hold': '#ffd60a',
  'Not Available': '#ff453a',
  'In Reno': '#6e6e73',
  Rented: '#bf5af2',
};

function hashOffset(id: string): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const jx = ((h % 100) / 100 - 0.5) * 0.002;
  const jy = (((h >> 8) % 100) / 100 - 0.5) * 0.002;
  return [jx, jy];
}

export function MapPanel() {
  const active = useMatch('/app/map');
  const { data } = useQuery({
    queryKey: ['listings-map'],
    queryFn: () => api.get<{ items: Listing[] }>('/api/listings?page=1&pageSize=5000'),
    enabled: !!active,
  });

  const markers = useMemo(() => {
    return (data?.items ?? []).map((listing) => {
      let coords: [number, number] | null = null;
      let approximate = false;
      if (listing.latitude && listing.longitude) {
        const [jx, jy] = hashOffset(listing.id);
        coords = [listing.latitude + jx, listing.longitude + jy];
      } else {
        const q = (listing.quartier ?? '').toLowerCase().trim();
        const fallback = QUARTIER_COORDS[q];
        if (fallback) {
          coords = fallback;
          approximate = true;
        }
      }
      return { listing, coords, approximate };
    }).filter((m) => m.coords);
  }, [data?.items]);

  return (
    <div className="panel-scroll map-panel">
      <div id="map-container" style={{ minHeight: active ? 320 : 0 }}>
        {active && (
        <MapContainer center={[45.52, -73.6]} zoom={11} style={{ height: '100%', width: '100%', minHeight: 320 }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
          {markers.map(({ listing, coords, approximate }) => (
            <CircleMarker
              key={listing.id}
              center={coords!}
              radius={7}
              pathOptions={{
                color: '#fff',
                weight: 2,
                fillColor: colors[listing.statut] ?? '#6e6e73',
                fillOpacity: approximate ? 0.45 : 0.9,
              }}
            >
              <Popup>
                <b>{esc(listing.adresse)}</b><br />
                {approximate && <small>Position approximative</small>}<br />
                {formatPrice(listing.prix)}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
        <Legend color="#30d158" label="Disponible" />
        <Legend color="#ffd60a" label="En attente" />
        <Legend color="#ff453a" label="Non dispo" />
        <Legend color="#6e6e73" label="Rénovation" />
        <Legend color="#bf5af2" label="Loué" />
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
