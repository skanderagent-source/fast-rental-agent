import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { useToast } from '../../components/common/ToastProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

import type { AgentStats } from '@fast-rental/shared';

type AdminUser = { id: string; nom: string; email: string; role: string; actif: boolean };

export function AdminPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get<Record<string, number>>('/api/admin/stats'),
  });
  const { data: agents, refetch: refetchAgents } = useQuery({
    queryKey: ['admin-agents'],
    queryFn: () => api.get<AgentStats[]>('/api/admin/agents/stats'),
    refetchInterval: 3_600_000,
  });
  const { data: users, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get<AdminUser[]>('/api/users'),
  });
  const { data: activity } = useQuery({
    queryKey: ['activity'],
    queryFn: () => api.get<Array<{ agent_nom: string; details: string; created_at: string }>>('/api/admin/activity'),
  });
  const { data: sheetRuns, refetch: refetchSheets } = useQuery({
    queryKey: ['sheet-runs'],
    queryFn: () => api.get<Array<Record<string, unknown>>>('/api/admin/sheets/runs'),
  });

  const [newUser, setNewUser] = useState({ nom: '', email: '', telephone: '', password: '', role: 'agent' });
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const [suspendStep, setSuspendStep] = useState<0 | 1 | 2>(0);
  const [reactivateTarget, setReactivateTarget] = useState<AdminUser | null>(null);
  const [reactivateStep, setReactivateStep] = useState<0 | 1 | 2>(0);

  async function refreshUsers() {
    await Promise.all([refetchUsers(), refetchAgents()]);
  }

  function cancelDelete() {
    setDeleteTarget(null);
    setDeleteStep(0);
  }

  function cancelSuspend() {
    setSuspendTarget(null);
    setSuspendStep(0);
  }

  function cancelReactivate() {
    setReactivateTarget(null);
    setReactivateStep(0);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await api.delete(`/api/users/${deleteTarget.id}`);
    toast('Compte supprimé');
    cancelDelete();
    void refreshUsers();
  }

  async function confirmSuspend() {
    if (!suspendTarget) return;
    await api.post(`/api/users/${suspendTarget.id}/deactivate`);
    toast('Compte suspendu');
    cancelSuspend();
    void refreshUsers();
  }

  async function confirmReactivate() {
    if (!reactivateTarget) return;
    await api.post(`/api/users/${reactivateTarget.id}/reactivate`);
    toast('Compte réactivé');
    cancelReactivate();
    void refreshUsers();
  }

  return (
    <div className="panel-scroll admin-page">
      <section className="profile-card">
        <h2 className="profile-card__title">Statistiques</h2>
        <div className="admin-stats-grid">
          <StatCard label="Logements" value={stats?.totalListings ?? 0} />
          <StatCard label="Disponibles" value={stats?.availableListings ?? 0} />
          <StatCard label="Demandes" value={stats?.totalLeads ?? 0} />
        </div>
      </section>

      <section className="profile-card">
        <h2 className="profile-card__title">Créer un compte</h2>
        <div className="admin-form-grid">
          <div className="form-field">
            <label htmlFor="new-user-nom">Nom</label>
            <input id="new-user-nom" placeholder="Nom complet" value={newUser.nom} onChange={(e) => setNewUser({ ...newUser, nom: e.target.value })} />
          </div>
          <div className="form-field">
            <label htmlFor="new-user-email">Email</label>
            <input id="new-user-email" placeholder="email@exemple.com" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
          </div>
          <div className="form-field">
            <label htmlFor="new-user-telephone">Téléphone</label>
            <input
              id="new-user-telephone"
              type="tel"
              placeholder="514-555-0100"
              value={newUser.telephone}
              onChange={(e) => setNewUser({ ...newUser, telephone: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label htmlFor="new-user-password">Mot de passe temporaire</label>
            <input id="new-user-password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
          </div>
          <div className="form-field">
            <label htmlFor="new-user-role">Rôle</label>
            <select id="new-user-role" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="button"
            className="profile-btn profile-btn--primary admin-form-grid__submit"
            onClick={async () => {
              const payload = {
                nom: newUser.nom,
                email: newUser.email,
                password: newUser.password,
                role: newUser.role,
                ...(newUser.telephone.trim() ? { telephone: newUser.telephone.trim() } : {}),
              };
              await api.post('/api/users', payload);
              toast('✅ Compte créé');
              setNewUser({ nom: '', email: '', telephone: '', password: '', role: 'agent' });
              void refreshUsers();
            }}
          >
            Créer le compte
          </button>
        </div>
      </section>

      <section className="profile-card">
        <h2 className="profile-card__title">Gestion des comptes</h2>
        <div className="profile-list">
          {(users ?? []).map((u) => (
            <article key={u.id} className="profile-list-item profile-list-item--stacked admin-user-row">
              <div className="admin-user-row__main">
                <div>
                  <div className="profile-list-item__title">{u.nom}</div>
                  <div className="admin-user-row__email">{u.email}</div>
                  <div className="admin-user-row__role">{u.role === 'admin' ? 'Administrateur' : 'Agent'}</div>
                </div>
                <span className={`badge ${u.actif ? 'badge-d' : 'badge-n'}`}>{u.actif ? 'Actif' : 'Suspendu'}</span>
              </div>
              <div className="admin-user-row__actions">
                {u.actif ? (
                  <button
                    type="button"
                    className="profile-btn profile-btn--warning"
                    onClick={() => {
                      setSuspendTarget(u);
                      setSuspendStep(1);
                    }}
                  >
                    Suspendre
                  </button>
                ) : (
                  <button
                    type="button"
                    className="profile-btn profile-btn--ghost"
                    onClick={() => {
                      setReactivateTarget(u);
                      setReactivateStep(1);
                    }}
                  >
                    Réactiver
                  </button>
                )}
                <button
                  type="button"
                  className="profile-btn profile-btn--danger"
                  onClick={() => {
                    setDeleteTarget(u);
                    setDeleteStep(1);
                  }}
                >
                  Supprimer
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="profile-card">
        <h2 className="profile-card__title">Performance agents</h2>
        <div className="profile-list">
          {(agents ?? []).map((a) => (
            <article key={a.agentId} className="profile-list-item profile-list-item--static admin-agent-stat">
              <div className="profile-list-item__title">{a.nom}</div>
              <div className="admin-user-row__email">{a.email}</div>
              <div className="admin-agent-stat__metrics">
                Leads : {a.assignedLeads} · Contactés : {a.contactedLeads} · Réglés : {a.resolvedLeads} · Refusés : {a.refusedLeads} · Locations : {a.rentalCount} · Médias : {a.mediaUploaded}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="profile-card">
        <h2 className="profile-card__title">Email</h2>
        <button
          type="button"
          className="profile-btn profile-btn--ghost"
          onClick={async () => {
            await api.post('/api/admin/email/test');
            toast('✅ Email de test envoyé (ou loggé si EMAIL_ENABLED=false)');
          }}
        >
          Envoyer un email de test
        </button>
      </section>

      <section className="profile-card">
        <h2 className="profile-card__title">Import Google Sheets</h2>
        <p className="admin-section-note">
          Import ponctuel depuis Fast Rental (Sheet1) et Orcha (orcha rentals). Relançable sans doublons (UPSERT par adresse).
          Les champs locataire restent internes à l&apos;app agent.
        </p>
        <div className="admin-actions-row">
          <button
            type="button"
            className="profile-btn profile-btn--ghost"
            onClick={async () => {
              const preview = await api.get<{
                total: number;
                sample: Array<Record<string, unknown>>;
                summary: { bySource: Record<string, number>; byStatut: Record<string, number> };
                stats: Array<{ source: string; tabName: string; rowsValid: number; rowsSeen: number }>;
              }>('/api/admin/sheets/preview');
              const lines = preview.stats.map((s) => `${s.tabName}: ${s.rowsValid}/${s.rowsSeen}`).join(' · ');
              toast(`Aperçu: ${preview.total} logements (${lines})`);
              console.info('Sheet preview sample', preview.sample, preview.summary);
            }}
          >
            Aperçu (sans écriture)
          </button>
          <button
            type="button"
            className="profile-btn profile-btn--primary"
            onClick={async () => {
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
            }}
          >
            Importer depuis Sheets
          </button>
          <button
            type="button"
            className="profile-btn profile-btn--ghost"
            onClick={async () => {
              if (!confirm('Sync avec protection des champs modifiés manuellement dans l\'app ?')) return;
              await api.post('/api/admin/sheets/sync');
              toast('✅ Sync terminée');
              void refetchSheets();
              void refetchStats();
              void queryClient.invalidateQueries({ queryKey: ['listings-map'] });
            }}
          >
            Sync (respecte overrides)
          </button>
        </div>
        <div className="admin-sheet-runs">
          {(sheetRuns ?? []).slice(0, 5).map((run) => (
            <div key={String(run.id)} className="admin-sheet-run">
              {String(run.source)} — {String(run.status)} — vus {String(run.rows_seen)} / ins {String(run.rows_inserted)} / maj {String(run.rows_updated)}
            </div>
          ))}
        </div>
      </section>

      <section className="profile-card">
        <h2 className="profile-card__title">Activité récente</h2>
        <div className="profile-list">
          {(activity ?? []).map((a, i) => (
            <div key={i} className="profile-list-item profile-list-item--static admin-activity-item">
              <div className="profile-list-item__title">{a.agent_nom}</div>
              <div className="admin-activity-item__details">{a.details}</div>
            </div>
          ))}
        </div>
      </section>

      <ConfirmDialog
        open={deleteStep === 1}
        message={`Vous êtes sur le point de supprimer le compte de ${deleteTarget?.nom ?? "l'utilisateur"}.`}
        confirmLabel="Continuer"
        cancelLabel="Annuler"
        confirmTone="danger"
        onConfirm={() => setDeleteStep(2)}
        onCancel={cancelDelete}
      />
      <ConfirmDialog
        open={deleteStep === 2}
        message={`L'agent ${deleteTarget?.nom ?? "l'utilisateur"} sera supprimé.`}
        confirmLabel="Confirmer"
        cancelLabel="Annuler"
        confirmTone="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={cancelDelete}
      />

      <ConfirmDialog
        open={suspendStep === 1}
        message={`Vous êtes sur le point de suspendre le compte de ${suspendTarget?.nom ?? "l'utilisateur"}.`}
        confirmLabel="Continuer"
        cancelLabel="Annuler"
        confirmTone="primary"
        onConfirm={() => setSuspendStep(2)}
        onCancel={cancelSuspend}
      />
      <ConfirmDialog
        open={suspendStep === 2}
        message={`L'agent ${suspendTarget?.nom ?? "l'utilisateur"} sera suspendu.`}
        confirmLabel="Confirmer"
        cancelLabel="Annuler"
        confirmTone="danger"
        onConfirm={() => void confirmSuspend()}
        onCancel={cancelSuspend}
      />

      <ConfirmDialog
        open={reactivateStep === 1}
        message={`Vous êtes sur le point de réactiver le compte de ${reactivateTarget?.nom ?? "l'utilisateur"}.`}
        confirmLabel="Continuer"
        cancelLabel="Annuler"
        confirmTone="primary"
        onConfirm={() => setReactivateStep(2)}
        onCancel={cancelReactivate}
      />
      <ConfirmDialog
        open={reactivateStep === 2}
        message={`L'agent ${reactivateTarget?.nom ?? "l'utilisateur"} sera réactivé.`}
        confirmLabel="Confirmer"
        cancelLabel="Annuler"
        confirmTone="primary"
        onConfirm={() => void confirmReactivate()}
        onCancel={cancelReactivate}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-stat-card">
      <div className="admin-stat-card__value">{value}</div>
      <div className="admin-stat-card__label">{label}</div>
    </div>
  );
}
