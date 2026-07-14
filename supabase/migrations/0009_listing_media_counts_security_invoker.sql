-- Supabase linter: views default to owner privileges (SECURITY DEFINER behavior).
-- security_invoker makes the view respect RLS on logements / listing_media for the querying user.
create or replace view public.listing_media_counts
with (security_invoker = true)
as
select
  l.id as listing_id,
  count(m.id) filter (where m.status = 'approved') as approved_media_count,
  count(m.id) filter (where m.status = 'approved' and m.type = 'image') as approved_image_count,
  count(m.id) filter (where m.status = 'pending') as pending_media_count
from logements l
left join listing_media m on m.listing_id = l.id
where l.deleted_at is null
group by l.id;
