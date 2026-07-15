import { useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/apiClient';
import { esc, formatEventDate } from '../../lib/format';
import {
  extractUserMessage,
  formatLeadCurrency,
  leadTypeLabel,
  parseDossierTal,
  traitementStatutLabel,
} from '../../lib/leads';
import { LeadProgressControl } from '../agent/LeadProgressControl';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../components/common/ToastProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import type { LeadListItem } from '@fast-rental/shared';

type LeadsResponse = {
  items: LeadListItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: { badgeCount: number };
};
type AgentOption = { id: string; nom: string; email: string; actif: boolean };
type LeadView = 'active' | 'archived';

type ArchiveFilters = {
  assignedTo: string;
  archivedFrom: string;
  archivedTo: string;
};

const emptyArchiveFilters = (): ArchiveFilters => ({
  assignedTo: '',
  archivedFrom: '',
  archivedTo: '',
});

function buildLeadsQuery(
  view: LeadView,
  filters: ArchiveFilters,
  isAdmin: boolean,
  page: number,
) {
  const params = new URLSearchParams({
    includeArchived: String(view === 'archived'),
    page: String(page),
    pageSize: '50',
  });
  if (view === 'archived') {
    if (isAdmin && filters.assignedTo) params.set('assignedTo', filters.assignedTo);
    if (filters.archivedFrom) params.set('archivedFrom', filters.archivedFrom);
    if (filters.archivedTo) params.set('archivedTo', filters.archivedTo);
  }
  return params.toString();
}

function LeadAssignBlock({
  lead,
  agents,
  onAssigned,
}: {
  lead: LeadListItem;
  agents: AgentOption[];
  onAssigned: () => void;
}) {
  const toast = useToast();
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  async function assignLead() {
    if (!selectedAgentId) return;
    try {
      await api.post(`/api/leads/${lead.id}/assign`, { agentId: selectedAgentId });
      toast('✅ Assigné et archivé');
      setSelectedAgentId('');
      setConfirmOpen(false);
      onAssigned();
    } catch (err) {
      console.error('Lead assignment failed', err);
      const message = err instanceof ApiError ? err.message : 'Assignation impossible';
      toast(`⚠️ ${message}`);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="demande-assign">
      <div className="form-field demande-assign__field">
        <select
          id={`assign-${lead.id}`}
          aria-label="Choisir un agent"
          value={selectedAgentId}
          onChange={(e) => setSelectedAgentId(e.target.value)}
        >
          <option value="">Choisir un agent…</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nom}{a.email ? ` (${a.email})` : ''}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="profile-btn profile-btn--primary demande-assign__confirm"
        disabled={!selectedAgentId}
        onClick={() => setConfirmOpen(true)}
      >
        Confirmer
      </button>
      <ConfirmDialog
        open={confirmOpen}
        message={`Vous êtes sur le point d'assigner cette demande à ${selectedAgent?.nom ?? "l'agent"}, êtes-vous sûr ?`}
        confirmLabel="Assigner"
        confirmTone="primary"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void assignLead()}
      />
    </div>
  );
}

function LeadDetails({ lead }: { lead: LeadListItem }) {
  const userMessage = extractUserMessage(lead.message);
  const dossierTal = lead.type_demande === 'prequal' ? parseDossierTal(lead.message) : null;

  return (
    <div className="demande-card__meta">
      <div className="demande-card__line">
        <span className="demande-card__label">Type</span>
        <span>{leadTypeLabel(lead.type_demande)}</span>
      </div>
      <div className="demande-card__line">
        <span className="demande-card__label">Téléphone</span>
        <span>{lead.telephone ? esc(lead.telephone) : '—'}</span>
      </div>
      <div className="demande-card__line">
        <span className="demande-card__label">Email</span>
        <span>{lead.email ? esc(lead.email) : '—'}</span>
      </div>
      {lead.listing_adresse && (
        <div className="demande-card__line">
          <span className="demande-card__label">Logement</span>
          <span>{esc(lead.listing_adresse)}</span>
        </div>
      )}
      {lead.type_demande === 'prequal' && (
        <>
          <div className="demande-card__line">
            <span className="demande-card__label">Revenu mensuel</span>
            <span>{formatLeadCurrency(lead.revenu_mensuel) ?? '—'}</span>
          </div>
          <div className="demande-card__line">
            <span className="demande-card__label">Cote de crédit</span>
            <span>{lead.score_credit ?? '—'}</span>
          </div>
          <div className="demande-card__line">
            <span className="demande-card__label">Dossier TAL</span>
            <span>{dossierTal == null ? '—' : dossierTal ? 'Oui' : 'Non'}</span>
          </div>
          <div className="demande-card__line">
            <span className="demande-card__label">Date déménagement</span>
            <span>
              {lead.date_demenagement
                ? new Date(`${lead.date_demenagement}T12:00:00`).toLocaleDateString('fr-CA')
                : '—'}
            </span>
          </div>
        </>
      )}
      {userMessage && (
        <div className="demande-card__line demande-card__line--message">
          <span className="demande-card__label">Message</span>
          <span>{esc(userMessage)}</span>
        </div>
      )}
    </div>
  );
}

export function DemandesPanel() {
  const { profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<LeadView>('active');
  const [archiveFilters, setArchiveFilters] = useState<ArchiveFilters>(emptyArchiveFilters);
  const toast = useToast();

  const {
    data,
    refetch,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['leads', profile?.id, view, archiveFilters],
    queryFn: ({ pageParam }) => api.get<LeadsResponse>(
      `/api/leads?${buildLeadsQuery(view, archiveFilters, isAdmin, pageParam)}`,
    ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (
      lastPage.page * lastPage.pageSize < lastPage.total ? lastPage.page + 1 : undefined
    ),
    enabled: !!profile,
    refetchInterval: isAdmin ? false : 30_000,
    staleTime: 0,
  });

  const { data: agents } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<AgentOption[]>('/api/users'),
    enabled: isAdmin,
  });

  const activeAgents = (agents ?? []).filter((a) => a.actif !== false);
  const pages = data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const total = pages[0]?.total ?? items.length;

  function invalidateAfterAssign() {
    void queryClient.invalidateQueries({ queryKey: ['leads'] });
    void queryClient.invalidateQueries({ queryKey: ['leads-badge'] });
  }

  function openArchives() {
    setArchiveFilters(emptyArchiveFilters());
    setView('archived');
  }

  function backToActiveLeads() {
    setArchiveFilters(emptyArchiveFilters());
    setView('active');
  }

  function updateArchiveFilter<K extends keyof ArchiveFilters>(key: K, value: ArchiveFilters[K]) {
    setArchiveFilters((current) => ({ ...current, [key]: value }));
  }

  if (isLoading) return <div className="panel-scroll empty">Chargement…</div>;

  return (
    <div className={`panel-scroll demandes-page${view === 'archived' ? ' demandes-page--archived' : ''}`}>
      <section className="profile-card demandes-toolbar">
        {view === 'active' ? (
          <div className="demandes-toolbar__row">
            <div>
              <h2 className="demandes-toolbar__title">{isAdmin ? 'Demandes clients' : 'Mes demandes'}</h2>
              <p className="demandes-toolbar__count">
                {total} demande{total > 1 ? 's' : ''}
                {items.length < total ? ` · ${items.length} affichée${items.length > 1 ? 's' : ''}` : ''}
              </p>
            </div>
            <button
              type="button"
              className="profile-btn profile-btn--ghost"
              onClick={openArchives}
            >
              Voir archives
            </button>
          </div>
        ) : (
          <>
            <div className="demandes-toolbar__row demandes-toolbar__row--archives">
              <button
                type="button"
                className="demandes-back-btn"
                aria-label="Retour aux demandes actives"
                onClick={backToActiveLeads}
              >
                ←
              </button>
              <h2 className="demandes-toolbar__archives-title">{isAdmin ? 'Archives' : 'Mes archives'}</h2>
            </div>

            <div className="demandes-toolbar__filters">
              {isAdmin && (
                <div className="form-field demandes-toolbar__filter">
                  <label htmlFor="demandes-archive-agent-filter">Agent assigné</label>
                  <select
                    id="demandes-archive-agent-filter"
                    value={archiveFilters.assignedTo}
                    onChange={(e) => updateArchiveFilter('assignedTo', e.target.value)}
                  >
                    <option value="">Tous les agents</option>
                    {activeAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>{agent.nom}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-field demandes-toolbar__filter">
                <label htmlFor="demandes-archive-from-filter">Archivée du</label>
                <input
                  id="demandes-archive-from-filter"
                  type="date"
                  value={archiveFilters.archivedFrom}
                  onChange={(e) => updateArchiveFilter('archivedFrom', e.target.value)}
                />
              </div>
              <div className="form-field demandes-toolbar__filter">
                <label htmlFor="demandes-archive-to-filter">Archivée au</label>
                <input
                  id="demandes-archive-to-filter"
                  type="date"
                  value={archiveFilters.archivedTo}
                  min={archiveFilters.archivedFrom || undefined}
                  onChange={(e) => updateArchiveFilter('archivedTo', e.target.value)}
                />
              </div>
            </div>

            <p className="demandes-toolbar__count">
              {isFetching && !isFetchingNextPage
                ? 'Mise à jour…'
                : `${total} archive${total > 1 ? 's' : ''}${items.length < total ? ` · ${items.length} affichée${items.length > 1 ? 's' : ''}` : ''}`}
            </p>
          </>
        )}
      </section>

      {items.length === 0 && (
        <p className="profile-empty">
          {view === 'archived' ? 'Aucune archive pour ce filtre.' : 'Aucune demande pour le moment.'}
        </p>
      )}

      <div className="demandes-list">
        {items.map((lead) => (
          <article
            key={lead.id}
            className={`demande-card demande-card--styled${lead.statut === 'archivé' ? ' demande-card--archived' : ''}`}
          >
            <div className="demande-card__header">
              <h3 className="demande-card__name">{esc(lead.nom)}</h3>
              <div className="demande-card__badges">
                <span className="badge badge-a">{leadTypeLabel(lead.type_demande)}</span>
                <span className={`badge ${lead.assigne_a ? 'badge-x' : 'badge-a'}`}>
                  {lead.assigne_a
                    ? 'Assignée et archivée'
                    : (lead.statut === 'nouveau' ? 'Nouveau' : 'À assigner')}
                </span>
              </div>
            </div>

            <p className="demande-card__hint demande-card__hint--meta">
              Reçue le <time dateTime={lead.created_at}>{formatEventDate(lead.created_at)}</time>
            </p>

            <LeadDetails lead={lead} />

            {((isAdmin && (lead.ref_agent_username || lead.ref_agent_id))
              || (lead.statut === 'archivé' && lead.assigne_nom && isAdmin)
              || (lead.statut === 'archivé' && !isAdmin && view === 'archived' && lead.traitement_statut)
              || (lead.statut === 'archivé' && !lead.assigne_a && isAdmin && view === 'archived')) && (
              <div className="demande-card__footer-meta">
                {isAdmin && lead.ref_agent_username && (
                  <p className="demande-card__hint demande-card__hint--footer">
                    Lien de référence : {esc(lead.ref_agent_username)}
                  </p>
                )}
                {isAdmin && lead.ref_agent_id && !lead.ref_agent_username && (
                  <p className="demande-card__hint demande-card__hint--footer">
                    Lien de référence : agent {lead.ref_agent_id.slice(0, 8)}…
                  </p>
                )}

                {lead.statut === 'archivé' && lead.assigne_nom && isAdmin && (
                  <p className="demande-card__hint demande-card__hint--footer">
                    Assignée à {esc(lead.assigne_nom)}
                    {lead.archived_at && (
                      <>
                        {' · '}
                        <time dateTime={lead.archived_at}>{formatEventDate(lead.archived_at)}</time>
                      </>
                    )}
                    {lead.traitement_statut && ` · ${traitementStatutLabel(lead.traitement_statut)}`}
                  </p>
                )}

                {lead.statut === 'archivé' && !isAdmin && view === 'archived' && lead.traitement_statut && (
                  <p className="demande-card__hint demande-card__hint--footer">
                    Statut : {traitementStatutLabel(lead.traitement_statut)}
                    {lead.last_agent_update_at && (
                      <>
                        {' · Classé le '}
                        <time dateTime={lead.last_agent_update_at}>
                          {formatEventDate(lead.last_agent_update_at)}
                        </time>
                      </>
                    )}
                  </p>
                )}

                {lead.statut === 'archivé' && !lead.assigne_a && isAdmin && view === 'archived' && (
                  <p className="demande-card__hint demande-card__hint--footer demande-card__hint--warning">
                    Aucun agent assigné — cette demande n’apparaît pas dans les demandes d’un agent.
                  </p>
                )}
              </div>
            )}

            {isAdmin && !lead.assigne_a && (
              <LeadAssignBlock lead={lead} agents={activeAgents} onAssigned={invalidateAfterAssign} />
            )}

            {!isAdmin && lead.assigne_a && view === 'active' && (
              <LeadProgressControl
                lead={lead}
                onUpdated={() => {
                  void refetch();
                  void queryClient.invalidateQueries({ queryKey: ['leads-badge'] });
                }}
              />
            )}
          </article>
        ))}
      </div>

      {hasNextPage && (
        <div className="demandes-load-more">
          <button
            type="button"
            className="profile-btn profile-btn--ghost"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? 'Chargement…' : 'Charger plus'}
          </button>
        </div>
      )}
    </div>
  );
}
