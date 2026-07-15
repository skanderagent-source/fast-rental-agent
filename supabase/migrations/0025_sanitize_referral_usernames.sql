-- Usernames in referral URLs: lowercase letters and digits only (no dots, etc.)
-- Sanitize and dedupe in one pass — a bulk strip can collide (e.g. frenki.pocari → frenkipocari).

with sanitized as (
  select
    id,
    regexp_replace(lower(referral_slug), '[^a-z0-9]', '', 'g') as base_slug,
    created_at
  from public.agents
),
ranked as (
  select
    id,
    base_slug,
    row_number() over (partition by base_slug order by created_at, id) as rn
  from sanitized
),
resolved as (
  select
    id,
    case
      when length(base_slug) < 3 then 'agent' || substr(replace(id::text, '-', ''), 1, 6)
      when rn > 1 then left(base_slug, 26) || substr(replace(id::text, '-', ''), 1, 6)
      else base_slug
    end as new_slug
  from ranked
)
update public.agents a
set referral_slug = resolved.new_slug
from resolved
where a.id = resolved.id
  and a.referral_slug is distinct from resolved.new_slug;
