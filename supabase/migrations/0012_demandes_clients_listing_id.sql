-- The legacy shared table used logement_id; Fast Rental and Union Rental use
-- listing_id for callback lead association. Keep the legacy column intact.
alter table public.demandes_clients
  add column if not exists listing_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'demandes_clients_listing_id_fkey'
  ) then
    alter table public.demandes_clients
      add constraint demandes_clients_listing_id_fkey
      foreign key (listing_id) references public.logements(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'demandes_clients'
      and column_name = 'logement_id'
  ) then
    execute '
      update public.demandes_clients as demand
      set listing_id = demand.logement_id
      from public.logements as listing
      where demand.listing_id is null
        and demand.logement_id = listing.id
    ';
  end if;
end
$$;

create index if not exists demandes_clients_listing_id_idx
  on public.demandes_clients(listing_id);
