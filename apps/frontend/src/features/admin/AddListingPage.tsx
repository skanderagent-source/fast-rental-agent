import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { useToast } from '../../components/common/ToastProvider';

type ListingForm = {
  adresse: string;
  quartier: string;
  prix: string;
  taille: string;
  statut: string;
  electromenagers: string;
  code_entree: string;
  concierge_tel: string;
  notes: string;
  latitude: string;
  longitude: string;
};

const listingFields: Array<{
  key: keyof ListingForm;
  label: string;
  kind?: 'size' | 'statut';
  type?: 'number';
}> = [
  { key: 'adresse', label: 'Adresse' },
  { key: 'quartier', label: 'Quartier' },
  { key: 'prix', label: 'Prix', type: 'number' },
  { key: 'taille', label: 'Taille', kind: 'size' },
  { key: 'statut', label: 'Statut', kind: 'statut' },
  { key: 'electromenagers', label: 'Électroménagers' },
  { key: 'code_entree', label: 'Code entrée' },
  { key: 'concierge_tel', label: 'Tél. concierge' },
  { key: 'notes', label: 'Notes' },
  { key: 'latitude', label: 'Latitude', type: 'number' },
  { key: 'longitude', label: 'Longitude', type: 'number' },
];

function emptyForm(): ListingForm {
  return {
    adresse: '', quartier: '', prix: '', taille: '', statut: 'Available',
    electromenagers: '', code_entree: '', concierge_tel: '', notes: '',
    latitude: '', longitude: '',
  };
}

function listingToForm(listing: Record<string, unknown>): ListingForm {
  return {
    adresse: String(listing.adresse ?? ''),
    quartier: String(listing.quartier ?? ''),
    prix: listing.prix != null ? String(listing.prix) : '',
    taille: String(listing.taille ?? ''),
    statut: String(listing.statut ?? 'Available'),
    electromenagers: String(listing.electromenagers ?? ''),
    code_entree: String(listing.code_entree ?? ''),
    concierge_tel: String(listing.concierge_tel ?? ''),
    notes: String(listing.notes ?? ''),
    latitude: listing.latitude != null ? String(listing.latitude) : '',
    longitude: listing.longitude != null ? String(listing.longitude) : '',
  };
}

function formToPayload(form: ListingForm) {
  return {
    adresse: form.adresse,
    quartier: form.quartier || null,
    prix: form.prix ? Number(form.prix) : null,
    taille: form.taille || null,
    statut: form.statut,
    electromenagers: form.electromenagers || null,
    code_entree: form.code_entree || null,
    concierge_tel: form.concierge_tel || null,
    notes: form.notes || null,
    latitude: form.latitude ? Number(form.latitude) : null,
    longitude: form.longitude ? Number(form.longitude) : null,
  };
}

function ListingFormFields({ form, setForm }: { form: ListingForm; setForm: (f: ListingForm) => void }) {
  return (
    <>
      {listingFields.map(({ key, label, kind, type }) => (
        <div key={key} className="form-field">
          <label>{label}</label>
          {kind === 'statut' ? (
            <select value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })}>
              <option value="Available">Disponible</option>
              <option value="On Hold">En attente</option>
              <option value="Not Available">Non dispo</option>
              <option value="In Reno">Rénovation</option>
              <option value="Rented">Loué</option>
            </select>
          ) : kind === 'size' ? (
            <select value={form.taille} onChange={(e) => setForm({ ...form, taille: e.target.value })}>
              <option value="">—</option>
              {['2.5', '3.5', '4.5', '5.5', '6.5'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <input type={type ?? 'text'} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          )}
        </div>
      ))}
    </>
  );
}

function GeocodingStatus({ status, error }: { status?: string | null; error?: string | null }) {
  if (!status) return null;
  const labels: Record<string, string> = {
    pending: 'Géocodage en cours…',
    success: 'Géocodage réussi',
    manual: 'Coordonnées manuelles',
    failed: 'Géocodage échoué',
  };
  return (
    <div style={{ fontSize: 13, padding: 10, borderRadius: 8, marginBottom: 12, background: 'var(--bg3)', color: status === 'failed' ? 'var(--red)' : 'var(--text2)' }}>
      📍 {labels[status] ?? status}{error ? ` — ${error}` : ''}
    </div>
  );
}

export function AddListingPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ListingForm>(emptyForm());
  const [geocodeStatus, setGeocodeStatus] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.adresse.trim()) return toast('⚠️ Adresse requise');
    const created = await api.post<{ geocoding_status?: string }>('/api/listings', formToPayload(form));
    void queryClient.invalidateQueries({ queryKey: ['listings'] });
    void queryClient.invalidateQueries({ queryKey: ['listings-map'] });
    setGeocodeStatus(created.geocoding_status ?? (form.latitude && form.longitude ? 'manual' : 'pending'));
    toast('✅ Logement ajouté');
    setTimeout(() => navigate('/app/search'), 1200);
  }

  return (
    <div className="panel-scroll">
      <h2>Nouvelle unité</h2>
      <GeocodingStatus status={geocodeStatus} />
      <form onSubmit={submit} style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <ListingFormFields form={form} setForm={setForm} />
        <button className="btn-add" type="submit">Ajouter le logement</button>
      </form>
    </div>
  );
}

export function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ListingForm>(emptyForm());

  const { data, isLoading, error } = useQuery({
    queryKey: ['listing-edit', id],
    queryFn: () => api.get<{ listing: Record<string, unknown> }>(`/api/listings/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (data?.listing) setForm(listingToForm(data.listing));
  }, [data?.listing]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !form.adresse.trim()) return toast('⚠️ Adresse requise');
    await api.patch(`/api/listings/${id}`, formToPayload(form));
    void queryClient.invalidateQueries({ queryKey: ['listings'] });
    void queryClient.invalidateQueries({ queryKey: ['listings-map'] });
    toast('✅ Logement mis à jour');
    navigate('/app/search');
  }

  async function remove() {
    if (!id || !confirm('Supprimer ce logement ?')) return;
    await api.delete(`/api/listings/${id}`);
    void queryClient.invalidateQueries({ queryKey: ['listings'] });
    void queryClient.invalidateQueries({ queryKey: ['listings-map'] });
    toast('Logement supprimé');
    navigate('/app/search');
  }

  if (isLoading) return <div className="panel-scroll empty">Chargement...</div>;
  if (error || !id) return <div className="panel-scroll empty">Logement introuvable</div>;

  return (
    <div className="panel-scroll">
      <h2>Modifier l'unité</h2>
      <GeocodingStatus
        status={String(data?.listing?.geocoding_status ?? '')}
        error={data?.listing?.geocoding_error ? String(data.listing.geocoding_error) : null}
      />
      <form onSubmit={submit} style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <ListingFormFields form={form} setForm={setForm} />
        <button className="btn-add" type="submit">Enregistrer</button>
        <button type="button" className="btn-secondary" onClick={() => void remove()}>Supprimer</button>
      </form>
    </div>
  );
}
