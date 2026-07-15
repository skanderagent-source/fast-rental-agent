-- Leads are kept indefinitely for future reference; stop scheduling automatic deletion.
create or replace function public.archive_assigned_lead()
returns trigger
language plpgsql
as $$
begin
  if new.assigne_a is not null and old.assigne_a is distinct from new.assigne_a then
    new.assigne_le = coalesce(new.assigne_le, now());
    new.statut = 'archivé';
    new.traitement_statut = coalesce(new.traitement_statut, 'assigné');
    new.archived_at = coalesce(new.archived_at, now());
    new.delete_after = null;
  end if;
  return new;
end;
$$;

alter function public.archive_assigned_lead() set search_path = public;

update public.demandes_clients
set delete_after = null
where delete_after is not null;
