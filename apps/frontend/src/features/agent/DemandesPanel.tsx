import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { esc } from '../../lib/format';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../components/common/ToastProvider';
import type { Lead } from '@fast-rental/shared';

type LeadsResponse = { items: Lead[]; summary: { badgeCount: number } };

export function DemandesPanel() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [includeArchived, setIncludeArchived] = useState(false);
  const toast = useToast();

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['leads', includeArchived],
    queryFn: () => api.get<LeadsResponse>(`/api/leads?includeArchived=${includeArchived}`),
  });

  const { data: agents } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<Array<{ id: string; nom: string; actif: boolean }>>('/api/users'),
    enabled: isAdmin,
  });

  if (isLoading) return <div className="panel-scroll empty">Chargement...</div>;

  return (
    <div className="panel-scroll">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>{data?.items.length ?? 0} demande(s)</div>
        <button className="btn-secondary" onClick={() => setIncludeArchived(!includeArchived)}>
          {includeArchived ? 'Masquer archives' : 'Voir archives'}
        </button>
      </div>
      {(data?.items ?? []).map((lead) => (
        <div key={lead.id} className="demande-card" style={{ padding: 12, marginBottom: 8, opacity: lead.statut === 'archivé' ? 0.6 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 600 }}>{esc(lead.nom)}</div>
            <span className="badge badge-a">{lead.statut === 'archivé' ? 'Assignée et archivée' : lead.statut}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6, lineHeight: 1.6 }}>
            {lead.telephone && <>📞 {esc(lead.telephone)}<br /></>}
            {lead.email && <>✉️ {esc(lead.email)}<br /></>}
            {lead.message && <>💬 {esc(lead.message)}</>}
          </div>
          {lead.ref_agent_id && isAdmin && (
            <div style={{ fontSize: 11, color: 'var(--blue)', marginTop: 6 }}>
              Suggestion référence: agent {lead.ref_agent_id.slice(0, 8)}...
            </div>
          )}
          {isAdmin && lead.statut !== 'archivé' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <select
                defaultValue=""
                onChange={async (e) => {
                  if (!e.target.value) return;
                  await api.post(`/api/leads/${lead.id}/assign`, { agentId: e.target.value });
                  toast('✅ Assigné et archivé');
                  void refetch();
                  void queryClient.invalidateQueries({ queryKey: ['leads-badge'] });
                }}
                style={{ flex: 1 }}
              >
                <option value="">Assigner à...</option>
                {(agents ?? []).filter((a) => a.actif !== false).map((a) => (
                  <option key={a.id} value={a.id}>{a.nom}</option>
                ))}
              </select>
            </div>
          )}
          {!isAdmin && lead.assigne_a && (
            <select
              value={lead.traitement_statut ?? 'assigné'}
              onChange={async (e) => {
                await api.patch(`/api/leads/${lead.id}/progress`, { traitementStatut: e.target.value });
                void refetch();
              }}
              style={{ marginTop: 10, width: '100%' }}
            >
              <option value="assigné">Assigné</option>
              <option value="contacté">Contacté</option>
              <option value="réglé">Réglé</option>
            </select>
          )}
        </div>
      ))}
    </div>
  );
}
