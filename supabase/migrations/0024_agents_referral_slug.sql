-- Pretty agent referral links: /r/{referral_slug} on Union Rental

alter table public.agents
  add column if not exists referral_slug text;

update public.agents
set referral_slug = lower(split_part(email, '@', 1))
where referral_slug is null;

-- Resolve rare duplicate local-parts (e.g. same username @ different domains)
with ranked as (
  select
    id,
    referral_slug,
    row_number() over (partition by referral_slug order by created_at, id) as rn
  from public.agents
  where referral_slug is not null
)
update public.agents a
set referral_slug = ranked.referral_slug || '-' || substr(replace(a.id::text, '-', ''), 1, 6)
from ranked
where a.id = ranked.id
  and ranked.rn > 1;

alter table public.agents
  alter column referral_slug set not null;

create unique index if not exists agents_referral_slug_key on public.agents (referral_slug);

-- Backfill: referral leads that were never assigned should appear in admin archives
do $$
declare
  r record;
begin
  for r in
    select id, ref_agent_id
    from public.demandes_clients
    where ref_agent_id is not null
      and assigne_a is null
  loop
    begin
      perform public.assign_demande_client(r.id, r.ref_agent_id, 'auto_referral');
    exception
      when others then
        raise notice 'referral backfill skipped %: %', r.id, sqlerrm;
    end;
  end loop;
end $$;
