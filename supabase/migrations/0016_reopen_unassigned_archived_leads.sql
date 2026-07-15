-- Leads archived without assigne_a are stuck: agents never see them and admins
-- mistake them for completed assignments. Re-open them in the unassigned queue.
update public.demandes_clients
set
  statut = 'nouveau',
  archived_at = null,
  traitement_statut = null
where assigne_a is null
  and statut in ('archivé', 'assigné', 'contacté', 'réglé');
