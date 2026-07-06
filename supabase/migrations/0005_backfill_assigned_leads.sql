update demandes_clients
set
  traitement_statut = case
    when statut in ('assigné','contacté','réglé') then statut
    else coalesce(traitement_statut, 'assigné')
  end,
  statut = 'archivé',
  archived_at = coalesce(archived_at, assigne_le, now()),
  delete_after = coalesce(
    delete_after,
    greatest(coalesce(assigne_le, now()) + interval '30 days', now() + interval '7 days')
  )
where assigne_a is not null
  and (statut <> 'archivé' or archived_at is null or delete_after is null);
