-- Tighten assignment security: only assign_demande_client may bypass field
-- protection (not every service_role write). Agents still cannot self-promote.

create or replace function public.protect_demande_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trusted path used by Fast Rental backend after API admin check.
  if coalesce(current_setting('fast_rental.allow_demande_assign', true), '') = 'true' then
    return new;
  end if;

  if not is_admin() then
    new.nom := old.nom;
    new.telephone := old.telephone;
    new.email := old.email;
    new.message := old.message;
    new.revenu_mensuel := old.revenu_mensuel;
    new.date_demenagement := old.date_demenagement;
    new.type_demande := old.type_demande;
    new.logement_id := old.logement_id;
    new.ref_agent_id := old.ref_agent_id;
    new.assigne_a := old.assigne_a;
    new.assigne_nom := old.assigne_nom;
    new.assigne_le := old.assigne_le;
    new.assignation_type := old.assignation_type;
  end if;

  return new;
end;
$$;

-- Belt-and-suspenders: even if RLS policies are loosened later, block role escalation
-- unless the caller is already an admin (direct Supabase dashboard / SQL excluded).
create or replace function public.protect_agent_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if not is_admin() then
    new.role := old.role;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_agent_role on public.agents;
create trigger trg_protect_agent_role
before update on public.agents
for each row execute function public.protect_agent_role();
