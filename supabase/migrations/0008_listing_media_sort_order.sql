alter table listing_media add column if not exists sort_order integer not null default 0;

-- Backfill existing rows by upload time within each listing.
with ranked as (
  select
    id,
    row_number() over (partition by listing_id order by created_at asc) - 1 as new_order
  from listing_media
)
update listing_media m
set sort_order = ranked.new_order
from ranked
where m.id = ranked.id;

create index if not exists listing_media_listing_sort_idx on listing_media(listing_id, sort_order);

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
  next_sort integer;
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

  select coalesce(max(sort_order), -1) + 1
  into next_sort
  from listing_media
  where listing_id = p_listing_id;

  insert into listing_media (
    listing_id, uploaded_by, type, status, bucket, object_key,
    original_filename, mime_type, size_bytes, sort_order
  ) values (
    p_listing_id, p_uploaded_by, p_type, 'pending', p_bucket, p_object_key,
    p_original_filename, p_mime_type, p_size_bytes, next_sort
  )
  returning id into new_id;

  return new_id;
end;
$$;

alter function public.reserve_listing_media_upload(uuid, uuid, text, text, text, text, text, bigint, integer, integer) set search_path = public;
