import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { useToast } from '../../components/common/ToastProvider';

export function AdminPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: stats, refetch: refetchStats } = useQuery({ queryKey: ['admin-stats'], queryFn: () => api.get<Record<string, number>>('/api/admin/stats') });
  const { data: agents, refetch: refetchAgents } = useQuery({ queryKey: ['admin-agents'], queryFn: () => api.get<Array<Record<string, unknown>>>('/api/admin/agents/stats') });
  const { data: users, refetch: refetchUsers } = useQuery({ queryKey: ['admin-users'], queryFn: () => api.get<Array<{ id: string; nom: string; email: string; role: string; actif: boolean }>>('/api/users') });
  const { data: activity } = useQuery({ queryKey: ['activity'], queryFn: () => api.get<Array<{ agent_nom: string; details: string; created_at: string }>>('/api/admin/activity') });
  const { data: sheetRuns, refetch: refetchSheets } = useQuery({ queryKey: ['sheet-runs'], queryFn: () => api.get<Array<Record<string, unknown>>>('/api/admin/sheets/runs') });

  const [newUser, setNewUser] = useState({ nom: '', email: '', password: '', role: 'agent' });

  return (
    <div className="panel-scroll">
      <h2>Statistiques</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '12px 0 24px' }}>
        <StatCard label="Logements" value={stats?.totalListings ?? 0} />
        <StatCard label="Disponibles" value={stats?.availableListings ?? 0} />
        <StatCard label="Demandes" value={stats?.totalLeads ?? 0} />
      </div>

      <h2>Créer un compte</h2>
      <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
        <input placeholder="Nom" value={newUser.nom} onChange={(e) => setNewUser({ ...newUser, nom: e.target.value })} />
        <input placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
        <input placeholder="Mot de passe temporaire" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
        <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
          <option value="agent">Agent</option>
          <option value="admin">Admin</option>
        </select>
        <button className="btn-add" onClick={async () => {
          await api.post('/api/users', newUser);
          toast('✅ Compte créé');
          setNewUser({ nom: '', email: '', password: '', role: 'agent' });
          void refetchAgents();
          void refetchUsers();
        }}>Créer le compte</button>
      </div>

      <h2>Gestion des comptes</h2>
      <div style={{ marginBottom: 24 }}>
        {(users ?? []).map((u) => (
          <div key={u.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{u.nom}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{u.email} · {u.role}</div>
              </div>
              <span className={`badge ${u.actif ? 'badge-d' : 'badge-n'}`}>{u.actif ? 'Actif' : 'Inactif'}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {u.actif ? (
                <button className="btn-secondary" onClick={async () => {
                  await api.post(`/api/users/${u.id}/deactivate`);
                  toast('Compte désactivé');
                  void refetchUsers();
                  void refetchAgents();
                }}>Désactiver</button>
              ) : (
                <button className="btn-secondary" onClick={async () => {
                  await api.post(`/api/users/${u.id}/reactivate`);
                  toast('Compte réactivé');
                  void refetchUsers();
                  void refetchAgents();
                }}>Réactiver</button>
              )}
              <button className="btn-secondary" onClick={async () => {
                if (!confirm(`Supprimer définitivement ${u.nom} ?`)) return;
                await api.delete(`/api/users/${u.id}`);
                toast('Compte supprimé');
                void refetchUsers();
                void refetchAgents();
              }}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>

      <h2>Performance agents</h2>
      <div style={{ marginBottom: 24 }}>
        {(agents ?? []).map((a) => (
          <div key={String(a.agentId)} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>{String(a.nom)}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              Leads: {String(a.assignedLeads)} · Contactés: {String(a.contactedLeads)} · Locations: {String(a.rentalCount)} · Médias: {String(a.mediaUploaded)}
            </div>
          </div>
        ))}
      </div>

      <h2>Email</h2>
      <button className="btn-secondary" style={{ marginBottom: 24 }} onClick={async () => {
        await api.post('/api/admin/email/test');
        toast('✅ Email de test envoyé (ou loggé si EMAIL_ENABLED=false)');
      }}>Envoyer un email de test</button>

      <h2>Import Google Sheets</h2>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
        Import ponctuel depuis Fast Rental (Sheet1) et Orcha (orcha rentals). Relançable sans doublons (UPSERT par adresse).
        Les champs locataire restent internes à l&apos;app agent.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className="btn-secondary" onClick={async () => {
          const preview = await api.get<{
            total: number;
            sample: Array<Record<string, unknown>>;
            summary: { bySource: Record<string, number>; byStatut: Record<string, number> };
            stats: Array<{ source: string; tabName: string; rowsValid: number; rowsSeen: number }>;
          }>('/api/admin/sheets/preview');
          const lines = preview.stats.map((s) => `${s.tabName}: ${s.rowsValid}/${s.rowsSeen}`).join(' · ');
          toast(`Aperçu: ${preview.total} logements (${lines})`);
          console.info('Sheet preview sample', preview.sample, preview.summary);
        }}>Aperçu (sans écriture)</button>
        <button className="btn-add" onClick={async () => {
          if (!confirm('Importer / mettre à jour tous les logements depuis Google Sheets ?')) return;
          const result = await api.post<{
            rowsInserted: number;
            rowsUpdated: number;
            rowsErrored: number;
          }>('/api/admin/sheets/import');
          toast(`✅ Import: ${result.rowsInserted} insérés, ${result.rowsUpdated} mis à jour`);
          void refetchSheets();
          void refetchStats();
          void queryClient.invalidateQueries({ queryKey: ['listings-map'] });
        }}>Importer depuis Sheets</button>
        <button className="btn-secondary" onClick={async () => {
          if (!confirm('Sync avec protection des champs modifiés manuellement dans l\'app ?')) return;
          await api.post('/api/admin/sheets/sync');
          toast('✅ Sync terminée');
          void refetchSheets();
          void refetchStats();
          void queryClient.invalidateQueries({ queryKey: ['listings-map'] });
        }}>Sync (respecte overrides)</button>
      </div>
      {(sheetRuns ?? []).slice(0, 5).map((run) => (
        <div key={String(run.id)} style={{ fontSize: 12, marginBottom: 6 }}>
          {String(run.source)} — {String(run.status)} — vus {String(run.rows_seen)} / ins {String(run.rows_inserted)} / maj {String(run.rows_updated)}
        </div>
      ))}

      <h2 style={{ marginTop: 24 }}>Activité récente</h2>
      {(activity ?? []).map((a, i) => (
        <div key={i} style={{ fontSize: 13, marginBottom: 6 }}>
          <strong>{a.agent_nom}</strong> — {a.details}
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-stat" style={{ padding: 16 }}>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{label}</div>
    </div>
  );
}
