alter table agents enable row level security;
alter table logements enable row level security;
alter table listing_media enable row level security;
alter table demandes_clients enable row level security;
alter table commentaires enable row level security;
alter table activite enable row level security;
alter table sheet_sync_runs enable row level security;
alter table app_settings enable row level security;
alter table user_media enable row level security;
alter table rentals enable row level security;
alter table geocode_cache enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.agents
    where id = auth.uid()
      and role = 'admin'
      and actif = true
  );
$$;

create or replace function public.is_active_agent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.agents
    where id = auth.uid()
      and actif = true
  );
$$;

drop policy if exists "agents_read_self_or_admin" on agents;
create policy "agents_read_self_or_admin"
on agents for select
using (id = auth.uid() or public.is_admin());

drop policy if exists "agents_admin_write" on agents;
create policy "agents_admin_write"
on agents for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "logements_read_active_agents" on logements;
create policy "logements_read_active_agents"
on logements for select
using (public.is_active_agent() and deleted_at is null);

drop policy if exists "logements_admin_write" on logements;
create policy "logements_admin_write"
on logements for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "listing_media_read_active_agents" on listing_media;
create policy "listing_media_read_active_agents"
on listing_media for select
using (public.is_active_agent());

drop policy if exists "listing_media_admin_update" on listing_media;
create policy "listing_media_admin_update"
on listing_media for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "demandes_admin_read_all" on demandes_clients;
create policy "demandes_admin_read_all"
on demandes_clients for select
using (public.is_admin());

drop policy if exists "demandes_agent_read_assigned" on demandes_clients;
create policy "demandes_agent_read_assigned"
on demandes_clients for select
using (public.is_active_agent() and assigne_a = auth.uid());

drop policy if exists "commentaires_read_active_agents" on commentaires;
create policy "commentaires_read_active_agents"
on commentaires for select
using (public.is_active_agent());

drop policy if exists "commentaires_delete_owner_or_admin" on commentaires;
create policy "commentaires_delete_owner_or_admin"
on commentaires for delete
using (agent_id = auth.uid() or public.is_admin());

drop policy if exists "activite_admin_read" on activite;
create policy "activite_admin_read"
on activite for select
using (public.is_admin());

drop policy if exists "user_media_read_own_or_admin" on user_media;
create policy "user_media_read_own_or_admin"
on user_media for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "rentals_admin_read_all" on rentals;
create policy "rentals_admin_read_all"
on rentals for select
using (public.is_admin());

drop policy if exists "rentals_agent_read_own" on rentals;
create policy "rentals_agent_read_own"
on rentals for select
using (agent_id = auth.uid());

drop policy if exists "sheet_sync_runs_admin_read" on sheet_sync_runs;
create policy "sheet_sync_runs_admin_read"
on sheet_sync_runs for select
using (public.is_admin());

drop policy if exists "app_settings_admin_read" on app_settings;
create policy "app_settings_admin_read"
on app_settings for select
using (public.is_admin());

drop policy if exists "app_settings_admin_update" on app_settings;
create policy "app_settings_admin_update"
on app_settings for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "geocode_cache_admin_read" on geocode_cache;
create policy "geocode_cache_admin_read"
on geocode_cache for select
using (public.is_admin());
