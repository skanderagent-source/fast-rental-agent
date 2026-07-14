-- Union Rental public read model. Fast Rental owns the shared schema.
-- Orcha imports are paused, so historic Orcha rows stay out of public inventory.
create or replace view public.public_available_listings as
select
  l.id, l.adresse, l.quartier, l.prix, l.taille, l.electromenagers,
  l.notes, l.statut, l.source, l.latitude, l.longitude,
  coalesce(c.approved_image_count, 0) as approved_image_count,
  coalesce(c.approved_media_count, 0) as approved_media_count
from public.logements l
left join public.listing_media_counts c on c.listing_id = l.id
where l.statut = 'Available'
  and l.deleted_at is null
  and coalesce(lower(l.source), '') <> 'orcha';

revoke select on public.public_available_listings from anon, authenticated;
