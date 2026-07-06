create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- Core tables (may already exist in production)
create table if not exists agents (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nom text not null,
  role text not null,
  actif boolean not null default true,
  must_change_password boolean not null default true,
  profile_photo_media_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists logements (
  id uuid primary key default gen_random_uuid(),
  adresse text not null,
  quartier text null,
  prix numeric null,
  taille text null,
  statut text not null default 'Available',
  electromenagers text null,
  code_entree text null,
  concierge_tel text null,
  notes text null,
  source text not null default 'manual',
  sheet_row_id text null unique,
  latitude double precision null,
  longitude double precision null,
  created_by uuid null references agents(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists demandes_clients (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid null references logements(id) on delete set null,
  nom text not null,
  telephone text null,
  email text null,
  revenu_mensuel numeric null,
  score_credit integer null,
  date_demenagement text null,
  message text null,
  type_demande text not null default 'rappel',
  statut text not null default 'nouveau',
  lu boolean not null default false,
  assigne_a uuid null references agents(id),
  assigne_nom text null,
  assigne_le timestamptz null,
  assignation_type text null,
  ref_agent_id uuid null references agents(id),
  archived_at timestamptz null,
  delete_after timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists commentaires (
  id uuid primary key default gen_random_uuid(),
  logement_id uuid not null references logements(id) on delete cascade,
  agent_id uuid not null references agents(id),
  agent_nom text not null,
  texte text not null,
  created_at timestamptz not null default now()
);

create table if not exists activite (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid null references agents(id) on delete set null,
  agent_nom text null,
  type_action text not null,
  details text not null,
  logement_id uuid null references logements(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references logements(id) on delete cascade,
  uploaded_by uuid not null references agents(id),
  approved_by uuid null references agents(id),
  type text not null,
  status text not null default 'pending',
  bucket text not null,
  object_key text not null unique,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  width integer null,
  height integer null,
  duration_seconds numeric null,
  rejection_reason text null,
  upload_completed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  approved_at timestamptz null
);

create table if not exists user_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references agents(id) on delete cascade,
  bucket text not null,
  object_key text not null unique,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create table if not exists rentals (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references logements(id) on delete restrict,
  agent_id uuid not null references agents(id) on delete restrict,
  lead_id uuid null references demandes_clients(id) on delete set null,
  monthly_rent numeric null,
  rented_at timestamptz not null default now(),
  notes text null,
  created_by uuid not null references agents(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists sheet_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  spreadsheet_id text not null,
  status text not null,
  rows_seen integer not null default 0,
  rows_inserted integer not null default 0,
  rows_updated integer not null default 0,
  rows_skipped integer not null default 0,
  error_message text null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null
);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists geocode_cache (
  normalized_address text primary key,
  latitude double precision not null,
  longitude double precision not null,
  provider text not null,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Additive columns for existing production tables
alter table agents add column if not exists profile_photo_media_id uuid null;
alter table agents add column if not exists updated_at timestamptz not null default now();

alter table logements add column if not exists created_by uuid null references agents(id);
alter table logements add column if not exists deleted_at timestamptz null;
alter table logements add column if not exists manual_overrides jsonb not null default '{}'::jsonb;
alter table logements add column if not exists sheet_updated_at timestamptz null;
alter table logements add column if not exists geocoded_at timestamptz null;
alter table logements add column if not exists geocoding_status text null;
alter table logements add column if not exists geocoding_error text null;
alter table logements add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table logements add column if not exists updated_at timestamptz not null default now();

alter table demandes_clients add column if not exists archived_at timestamptz null;
alter table demandes_clients add column if not exists delete_after timestamptz null;
alter table demandes_clients add column if not exists ref_agent_id uuid null references agents(id);
alter table demandes_clients add column if not exists assignation_type text null;
alter table demandes_clients add column if not exists updated_at timestamptz not null default now();
alter table demandes_clients add column if not exists traitement_statut text null;
alter table demandes_clients add column if not exists last_agent_update_at timestamptz null;

alter table listing_media add column if not exists upload_completed_at timestamptz null;
alter table listing_media add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table sheet_sync_runs add column if not exists rows_skipped integer not null default 0;

alter table activite add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'agents_profile_photo_media_id_fkey'
  ) then
    alter table agents
      add constraint agents_profile_photo_media_id_fkey
      foreign key (profile_photo_media_id)
      references user_media(id)
      on delete set null;
  end if;
exception when others then null;
end $$;

-- Indexes
create index if not exists logements_statut_idx on logements(statut);
create index if not exists logements_quartier_idx on logements(quartier);
create index if not exists logements_source_idx on logements(source);
create index if not exists logements_lat_lng_idx on logements(latitude, longitude);
create index if not exists logements_deleted_at_idx on logements(deleted_at);
create index if not exists logements_photo_sort_idx on logements(deleted_at, adresse);
create index if not exists logements_sheet_missing_idx on logements ((metadata ->> 'sheetMissing'));

create index if not exists listing_media_listing_id_idx on listing_media(listing_id);
create index if not exists listing_media_status_idx on listing_media(status);
create index if not exists listing_media_uploaded_by_idx on listing_media(uploaded_by);
create index if not exists listing_media_approved_idx on listing_media(listing_id) where status = 'approved';
create index if not exists listing_media_listing_status_type_idx on listing_media(listing_id, status, type);

create index if not exists demandes_clients_statut_idx on demandes_clients(statut);
create index if not exists demandes_clients_assigne_a_idx on demandes_clients(assigne_a);
create index if not exists demandes_clients_created_at_idx on demandes_clients(created_at desc);
create index if not exists demandes_clients_delete_after_idx on demandes_clients(delete_after);
create index if not exists demandes_clients_traitement_statut_idx on demandes_clients(traitement_statut);
create index if not exists demandes_clients_archive_cleanup_idx on demandes_clients(delete_after) where archived_at is not null;

create index if not exists commentaires_logement_created_idx on commentaires(logement_id, created_at);
create index if not exists activite_created_at_idx on activite(created_at desc);
create index if not exists activite_agent_id_idx on activite(agent_id);
create index if not exists user_media_user_id_idx on user_media(user_id);
create index if not exists rentals_agent_id_idx on rentals(agent_id);
create index if not exists rentals_listing_id_idx on rentals(listing_id);
create index if not exists rentals_rented_at_idx on rentals(rented_at desc);

create or replace view listing_media_counts as
select
  l.id as listing_id,
  count(m.id) filter (where m.status = 'approved') as approved_media_count,
  count(m.id) filter (where m.status = 'approved' and m.type = 'image') as approved_image_count,
  count(m.id) filter (where m.status = 'pending') as pending_media_count
from logements l
left join listing_media m on m.listing_id = l.id
where l.deleted_at is null
group by l.id;

create or replace function public.reserve_listing_media_upload(
  p_listing_id uuid,
  p_uploaded_by uuid,
  p_type text,
  p_bucket text,
  p_object_key text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint,
  p_max_images integer,
  p_max_videos integer
)
returns uuid
language plpgsql
security definer
as $$
declare
  current_count integer;
  new_id uuid;
begin
  if p_type not in ('image', 'video') then
    raise exception 'Invalid media type';
  end if;

  perform 1 from logements where id = p_listing_id and deleted_at is null;
  if not found then
    raise exception 'Listing not found';
  end if;

  select count(*)
  into current_count
  from listing_media
  where listing_id = p_listing_id
    and type = p_type
    and status in ('pending', 'approved');

  if p_type = 'image' and current_count >= p_max_images then
    raise exception 'Image limit reached';
  end if;

  if p_type = 'video' and current_count >= p_max_videos then
    raise exception 'Video limit reached';
  end if;

  insert into listing_media (
    listing_id, uploaded_by, type, status, bucket, object_key,
    original_filename, mime_type, size_bytes
  ) values (
    p_listing_id, p_uploaded_by, p_type, 'pending', p_bucket, p_object_key,
    p_original_filename, p_mime_type, p_size_bytes
  )
  returning id into new_id;

  return new_id;
end;
$$;

alter function public.reserve_listing_media_upload(uuid, uuid, text, text, text, text, text, bigint, integer, integer) set search_path = public;
