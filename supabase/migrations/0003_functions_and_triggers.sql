create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_agents_updated_at on agents;
create trigger trg_agents_updated_at
before update on agents
for each row execute function public.set_updated_at();

drop trigger if exists trg_logements_updated_at on logements;
create trigger trg_logements_updated_at
before update on logements
for each row execute function public.set_updated_at();

drop trigger if exists trg_demandes_updated_at on demandes_clients;
create trigger trg_demandes_updated_at
before update on demandes_clients
for each row execute function public.set_updated_at();

drop trigger if exists trg_app_settings_updated_at on app_settings;
create trigger trg_app_settings_updated_at
before update on app_settings
for each row execute function public.set_updated_at();

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
    new.delete_after = coalesce(new.delete_after, now() + interval '30 days');
  end if;
  return new;
end;
$$;

alter function public.archive_assigned_lead() set search_path = public;

drop trigger if exists trg_archive_assigned_lead on demandes_clients;
create trigger trg_archive_assigned_lead
before update on demandes_clients
for each row execute function public.archive_assigned_lead();
