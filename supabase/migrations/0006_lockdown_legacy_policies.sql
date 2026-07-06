-- Cutover only. Backup first.
do $$
declare p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('agents','logements','listing_media','demandes_clients','commentaires',
                        'activite','sheet_sync_runs','app_settings','user_media','rentals','geocode_cache')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table geocode_cache enable row level security;

create policy "agents_read_self_or_admin"
on agents for select using (id = auth.uid() or public.is_admin());

create policy "agents_admin_write"
on agents for all using (public.is_admin()) with check (public.is_admin());

create policy "logements_read_active_agents"
on logements for select using (public.is_active_agent() and deleted_at is null);

create policy "logements_admin_write"
on logements for all using (public.is_admin()) with check (public.is_admin());

create policy "listing_media_read_active_agents"
on listing_media for select using (public.is_active_agent());

create policy "listing_media_admin_update"
on listing_media for update using (public.is_admin()) with check (public.is_admin());

create policy "demandes_admin_read_all"
on demandes_clients for select using (public.is_admin());

create policy "demandes_agent_read_assigned"
on demandes_clients for select using (public.is_active_agent() and assigne_a = auth.uid());

create policy "commentaires_read_active_agents"
on commentaires for select using (public.is_active_agent());

create policy "commentaires_delete_owner_or_admin"
on commentaires for delete using (agent_id = auth.uid() or public.is_admin());

create policy "activite_admin_read"
on activite for select using (public.is_admin());

create policy "user_media_read_own_or_admin"
on user_media for select using (user_id = auth.uid() or public.is_admin());

create policy "rentals_admin_read_all"
on rentals for select using (public.is_admin());

create policy "rentals_agent_read_own"
on rentals for select using (agent_id = auth.uid());

create policy "sheet_sync_runs_admin_read"
on sheet_sync_runs for select using (public.is_admin());

create policy "app_settings_admin_read"
on app_settings for select using (public.is_admin());

create policy "app_settings_admin_update"
on app_settings for update using (public.is_admin()) with check (public.is_admin());

create policy "geocode_cache_admin_read"
on geocode_cache for select using (public.is_admin());
