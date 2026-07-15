-- Finalized leads must have statut = 'archivé' so archive cards show Réglé/Refusé.
-- Progress updates only touched traitement_statut; legacy Orcha rows may still store
-- workflow values in statut instead of traitement_statut.

update public.demandes_clients
set
  statut = 'archivé',
  archived_at = coalesce(archived_at, last_agent_update_at, assigne_le, created_at, now())
where traitement_statut in ('réglé', 'refusé')
  and statut is distinct from 'archivé';

update public.demandes_clients
set
  traitement_statut = coalesce(
    traitement_statut,
    case when statut in ('assigné', 'contacté') then statut end,
    'assigné'
  ),
  statut = 'archivé',
  archived_at = coalesce(archived_at, assigne_le, created_at, now())
where assigne_a is not null
  and statut in ('assigné', 'contacté', 'réglé')
  and statut is distinct from 'archivé';
