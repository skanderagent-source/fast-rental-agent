import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminUserSchema,
  isValidReferralUsername,
  normalizeReferralUsername,
  REFERRAL_USERNAME_MAX_LENGTH,
  REFERRAL_USERNAME_MIN_LENGTH,
  referralUsernameFromNom,
} from '@fast-rental/shared';
import { api, ApiError, sensitiveApi } from '../../lib/apiClient';
import { formatZodIssues, parseCreateUserPayload } from '../../lib/formValidation';
import { parseApi } from '../../lib/parseApi';
import { useSubmitLock, OfflineError } from '../../lib/useSubmitLock';
import { useToast } from '../../components/common/ToastProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { PasswordInput } from '../../components/common/PasswordInput';
import { SanitizedInput } from '../../components/common/SanitizedField';

import type { AgentStats } from '@fast-rental/shared';
import type { z } from 'zod';

type AdminUser = z.infer<typeof adminUserSchema>;

const USERNAME_HINT = `Lettres et chiffres seulement (a-z, 0-9), ${REFERRAL_USERNAME_MIN_LENGTH}–${REFERRAL_USERNAME_MAX_LENGTH} caractères.`;

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
    queryFn: async () => {
      const rows = await api.get<unknown[]>('/api/users');
      return rows.map((row) => parseApi(adminUserSchema, row, 'Utilisateur admin'));
    },
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
  const [usernameEditUser, setUsernameEditUser] = useState<AdminUser | null>(null);
  const [usernameStep, setUsernameStep] = useState<0 | 1 | 2>(0);
  const [newUsername, setNewUsername] = useState('');
  const [confirmUsername, setConfirmUsername] = useState('');
  const [pendingUsername, setPendingUsername] = useState('');
  const { locked: creatingUser, run: runCreateUser } = useSubmitLock({ requireOnline: true });

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

  function closeUsernameEdit() {
    setUsernameEditUser(null);
    setUsernameStep(0);
    setNewUsername('');
    setConfirmUsername('');
    setPendingUsername('');
  }

  function openUsernameEdit(user: AdminUser) {
    if (usernameEditUser?.id === user.id) {
      closeUsernameEdit();
      return;
    }
    setUsernameEditUser(user);
    setUsernameStep(0);
    setNewUsername('');
    setConfirmUsername('');
    setPendingUsername('');
  }

  function sanitizeUsernameInput(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function requestUsernameChange() {
    if (!usernameEditUser) return;
    const current = referralUsernameFromNom(usernameEditUser.nom) ?? '';
    const next = normalizeReferralUsername(newUsername);
    const confirm = normalizeReferralUsername(confirmUsername);

    if (!isValidReferralUsername(next)) {
      toast(`❌ Nom d'utilisateur invalide (${REFERRAL_USERNAME_MIN_LENGTH}–${REFERRAL_USERNAME_MAX_LENGTH} caractères, a-z et 0-9)`);
      return;
    }
    if (next !== confirm) {
      toast('❌ Les noms d\'utilisateur ne correspondent pas');
      return;
    }
    if (next === current) {
      toast('❌ Le nouveau nom d\'utilisateur doit être différent');
      return;
    }

    setPendingUsername(next);
    setUsernameStep(1);
  }

  async function confirmUsernameChange() {
    if (!usernameEditUser || !pendingUsername) return;
    try {
      await api.patch(`/api/users/${usernameEditUser.id}/referral-slug`, { referralSlug: pendingUsername });
      toast('✅ Nom d\'utilisateur mis à jour');
      closeUsernameEdit();
      void refreshUsers();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Mise à jour impossible';
      toast(`⚠️ ${message}`);
      setUsernameStep(0);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await sensitiveApi.delete(`/api/users/${deleteTarget.id}`, 'user.delete', deleteTarget.id);
    toast('Compte supprimé');
    cancelDelete();
    void refreshUsers();
  }

  async function confirmSuspend() {
    if (!suspendTarget) return;
    await sensitiveApi.post(`/api/users/${suspendTarget.id}/deactivate`, 'user.deactivate', suspendTarget.id);
    toast('Compte suspendu');
    cancelSuspend();
    void refreshUsers();
  }

  async function confirmReactivate() {
    if (!reactivateTarget) return;
    await sensitiveApi.post(`/api/users/${reactivateTarget.id}/reactivate`, 'user.reactivate', reactivateTarget.id);
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
            <SanitizedInput
              id="new-user-nom"
              kind="personName"
              maxLength={120}
              placeholder="Nom complet"
              value={newUser.nom}
              onChange={(value) => setNewUser({ ...newUser, nom: value })}
            />
          </div>
          <div className="form-field">
            <label htmlFor="new-user-email">Email</label>
            <SanitizedInput
              id="new-user-email"
              kind="email"
              maxLength={320}
              placeholder="email@exemple.com"
              value={newUser.email}
              onChange={(value) => setNewUser({ ...newUser, email: value })}
            />
          </div>
          <div className="form-field">
            <label htmlFor="new-user-telephone">Téléphone</label>
            <SanitizedInput
              id="new-user-telephone"
              kind="phone"
              maxLength={30}
              placeholder="5145550100"
              value={newUser.telephone}
              onChange={(value) => setNewUser({ ...newUser, telephone: value })}
            />
          </div>
          <div className="form-field">
            <label htmlFor="new-user-password">Mot de passe temporaire</label>
            <PasswordInput
              id="new-user-password"
              value={newUser.password}
              onChange={(value) => setNewUser({ ...newUser, password: value })}
              autoComplete="new-password"
            />
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
            disabled={creatingUser}
            onClick={() => void (async () => {
              try {
                await runCreateUser(async () => {
                  const parsed = parseCreateUserPayload(newUser);
                  if (!parsed.success) {
                    toast(`⚠️ ${formatZodIssues(parsed.error.issues)}`);
                    return;
                  }
                  await api.post('/api/users', parsed.data);
                  toast('✅ Compte créé');
                  setNewUser({ nom: '', email: '', telephone: '', password: '', role: 'agent' });
                  void refreshUsers();
                });
              } catch (err) {
                if (err instanceof OfflineError) toast(`⚠️ ${err.message}`);
              }
            })()}
          >
            {creatingUser ? 'Création…' : 'Créer le compte'}
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
                  <div className="admin-user-row__role">@{referralUsernameFromNom(u.nom) ?? u.nom}</div>
                  <div className="admin-user-row__role">{u.role === 'admin' ? 'Administrateur' : 'Agent'}</div>
                </div>
                <span className={`badge ${u.actif ? 'badge-d' : 'badge-n'}`}>{u.actif ? 'Actif' : 'Suspendu'}</span>
              </div>
              <div className="admin-user-row__actions">
                <div className="admin-user-row__actions-left">
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
                <button
                  type="button"
                  className={`profile-btn profile-btn--primary admin-user-row__modifier-btn${usernameEditUser?.id === u.id ? ' profile-btn--active' : ''}`}
                  onClick={() => openUsernameEdit(u)}
                >
                  Modifier
                </button>
              </div>
              {usernameEditUser?.id === u.id && (
                <div className="profile-expand admin-username-expand">
                  <div className="form-field">
                    <label htmlFor={`username-new-${u.id}`}>Nouveau nom d&apos;utilisateur</label>
                    <input
                      id={`username-new-${u.id}`}
                      value={newUsername}
                      onChange={(e) => setNewUsername(sanitizeUsernameInput(e.target.value))}
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={REFERRAL_USERNAME_MAX_LENGTH}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor={`username-confirm-${u.id}`}>Confirmer le nouveau nom d&apos;utilisateur</label>
                    <input
                      id={`username-confirm-${u.id}`}
                      value={confirmUsername}
                      onChange={(e) => setConfirmUsername(sanitizeUsernameInput(e.target.value))}
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={REFERRAL_USERNAME_MAX_LENGTH}
                    />
                    <p className="profile-field-hint">{USERNAME_HINT}</p>
                  </div>
                  <div className="profile-expand__actions">
                    <button type="button" className="profile-btn profile-btn--white" onClick={closeUsernameEdit}>
                      Annuler
                    </button>
                    <button type="button" className="profile-btn profile-btn--primary" onClick={requestUsernameChange}>
                      Confirmer
                    </button>
                  </div>
                </div>
              )}
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
                Assignés : {a.assignedLeads} · Contactés : {a.contactedLeads} · Réglés : {a.resolvedLeads} · Refusés : {a.refusedLeads} · Locations : {a.rentalCount} · Médias : {a.mediaUploaded}
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
            }}
          >
            Aperçu (sans écriture)
          </button>
          <button
            type="button"
            className="profile-btn profile-btn--primary"
            onClick={async () => {
              if (!confirm('Importer / mettre à jour tous les logements depuis Google Sheets ?')) return;
              const result = await sensitiveApi.post<{
                rowsInserted: number;
                rowsUpdated: number;
                rowsErrored: number;
              }>('/api/admin/sheets/import', 'sheets.import');
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
              await sensitiveApi.post('/api/admin/sheets/sync', 'sheets.sync');
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

      <ConfirmDialog
        open={usernameStep === 1}
        message={`Vous allez changer le nom d'utilisateur de ${usernameEditUser?.nom ?? "l'utilisateur"}.`}
        confirmLabel="Continuer"
        cancelLabel="Annuler"
        confirmTone="primary"
        onConfirm={() => setUsernameStep(2)}
        onCancel={() => setUsernameStep(0)}
      />
      <ConfirmDialog
        open={usernameStep === 2}
        message={`Changer le nom d'utilisateur de ${referralUsernameFromNom(usernameEditUser?.nom ?? '') ?? usernameEditUser?.nom ?? ''} à ${pendingUsername}.`}
        confirmLabel="Confirmer"
        cancelLabel="Annuler"
        confirmTone="primary"
        onConfirm={() => void confirmUsernameChange()}
        onCancel={() => setUsernameStep(0)}
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
