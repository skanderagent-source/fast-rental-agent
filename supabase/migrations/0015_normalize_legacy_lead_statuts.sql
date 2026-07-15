-- Union Rental and legacy flows may leave workflow values in `statut` instead of
-- `traitement_statut`. Normalize so Fast Rental active/archive filters stay correct.
update public.demandes_clients
set
  traitement_statut = coalesce(
    traitement_statut,
    case when statut in ('assigné', 'contacté', 'réglé') then statut end,
    'assigné'
  ),
  statut = 'archivé',
  archived_at = coalesce(archived_at, assigne_le, created_at, now())
where statut in ('assigné', 'contacté', 'réglé')
   or (assigne_a is not null and statut = 'nouveau');
