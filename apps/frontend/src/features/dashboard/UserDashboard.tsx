import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { api } from '../../lib/apiClient';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../components/common/ToastProvider';
import type { Lead } from '@fast-rental/shared';

export function UserDashboard() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [nom, setNom] = useState(profile?.nom ?? '');

  const { data: calls, refetch: refetchCalls } = useQuery({
    queryKey: ['my-calls'],
    queryFn: () => api.get<Lead[]>('/api/leads/my-calls'),
  });

  const { data: myRentals } = useQuery({
    queryKey: ['my-rentals'],
    queryFn: () => api.get<Array<{ id: string; monthly_rent: number | null; rented_at: string; logements?: { adresse: string; quartier: string } }>>('/api/rentals/me'),
  });

  const { data: myMedia } = useQuery({
    queryKey: ['my-media'],
    queryFn: async () => {
      const listings = await api.get<{ items: Array<{ id: string }> }>('/api/listings?page=1&pageSize=100');
      const all = await Promise.all(
        listings.items.map((l) => api.get<Array<{ id: string; original_filename: string; status: string; uploaded_by: string }>>(`/api/listings/${l.id}/media`)),
      );
      return all.flat().filter((m) => m.uploaded_by === profile?.id);
    },
    enabled: !!profile,
  });

  async function saveProfile() {
    await api.patch('/api/me', { nom });
    await refreshProfile();
    toast('✅ Profil mis à jour');
  }

  async function changePassword() {
    const pw = prompt('Nouveau mot de passe (min 6 caractères)');
    if (!pw || pw.length < 6) return;
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) toast('❌ ' + error.message);
    else toast('✅ Mot de passe mis à jour');
  }

  async function changeEmail() {
    const email = prompt('Nouveau email');
    if (!email) return;
    const { error } = await supabase.auth.updateUser({ email });
    if (error) toast('❌ ' + error.message);
    else toast('✅ Vérifie ta boîte mail pour confirmer');
  }

  async function uploadProfilePhoto(file: File) {
    const meta = await api.post<{ mediaId: string; uploadUrl: string }>('/api/listings/me/profile-photo/upload-url', {
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    await fetch(meta.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    await api.post(`/api/listings/me/profile-photo/${meta.mediaId}/complete`);
    await refreshProfile();
    toast('✅ Photo de profil mise à jour');
  }

  return (
    <div className="panel-scroll">
      <h2 style={{ marginBottom: 12 }}>Mon profil</h2>
      <div className="form-field">
        <label>Nom</label>
        <input value={nom} onChange={(e) => setNom(e.target.value)} />
      </div>
      <button className="btn-add" onClick={() => void saveProfile()}>Enregistrer</button>
      <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
        <button className="btn-secondary" onClick={() => void changeEmail()}>Changer email</button>
        <button className="btn-secondary" onClick={() => void changePassword()}>Changer mot de passe</button>
        <label className="btn-secondary" style={{ textAlign: 'center' }}>
          Photo de profil
          <input hidden type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void uploadProfilePhoto(e.target.files[0])} />
        </label>
      </div>

      <h3 style={{ margin: '24px 0 12px' }}>Liste des demandes d'appels</h3>
      {(calls ?? []).map((lead) => (
        <div key={lead.id} className="demande-card" style={{ padding: 12, marginBottom: 8 }}>
          <div style={{ fontWeight: 600 }}>{lead.nom}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{lead.traitement_statut ?? 'assigné'} · supprimée le {lead.delete_after ? new Date(lead.delete_after).toLocaleDateString('fr-CA') : '—'}</div>
          <select
            value={lead.traitement_statut ?? 'assigné'}
            style={{ marginTop: 8, width: '100%' }}
            onChange={async (e) => {
              await api.patch(`/api/leads/${lead.id}/progress`, { traitementStatut: e.target.value });
              void refetchCalls();
            }}
          >
            <option value="assigné">Assigné</option>
            <option value="contacté">Contacté</option>
            <option value="réglé">Réglé</option>
          </select>
        </div>
      ))}

      <h3 style={{ margin: '24px 0 12px' }}>Mes locations</h3>
      {(myRentals ?? []).map((r) => (
        <div key={r.id} className="demande-card" style={{ padding: 12, marginBottom: 8 }}>
          <div style={{ fontWeight: 600 }}>{r.logements?.adresse ?? 'Logement'}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>
            {r.logements?.quartier} · {r.monthly_rent != null ? `${r.monthly_rent}$/mois` : '—'} · {new Date(r.rented_at).toLocaleDateString('fr-CA')}
          </div>
        </div>
      ))}

      <h3 style={{ margin: '24px 0 12px' }}>Mes médias</h3>
      {(myMedia ?? []).map((m) => (
        <div key={m.id} style={{ fontSize: 13, marginBottom: 6 }}>{m.original_filename} — {m.status}</div>
      ))}
    </div>
  );
}
