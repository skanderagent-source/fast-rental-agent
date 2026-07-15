-- Legacy Orcha trigger protect_demande_fields() reverted assigne_a on every
-- PostgREST update because service_role is not is_admin(). Allow trusted
-- assignment via assign_demande_client and service_role JWT.

create or replace function public.protect_demande_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('fast_rental.allow_demande_assign', true), '') = 'true' then
    return new;
  end if;

  if coalesce(auth.jwt() ->> 'role', current_setting('request.jwt.claim.role', true)) = 'service_role' then
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

create or replace function public.assign_demande_client(
  p_lead_id uuid,
  p_agent_id uuid,
  p_assignation_type text default 'manual'
)
returns public.demandes_clients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent public.agents%rowtype;
  v_row public.demandes_clients%rowtype;
begin
  perform set_config('fast_rental.allow_demande_assign', 'true', true);

  select *
  into v_agent
  from public.agents
  where id = p_agent_id
    and coalesce(actif, true);

  if not found then
    raise exception 'Agent introuvable' using errcode = 'P0002';
  end if;

  update public.demandes_clients
  set
    assigne_a = p_agent_id,
    assigne_nom = v_agent.nom,
    assigne_le = now(),
    assignation_type = p_assignation_type,
    statut = 'archivé',
    traitement_statut = 'assigné',
    archived_at = now(),
    delete_after = null
  where id = p_lead_id
  returning * into v_row;

  if not found then
    raise exception 'Demande introuvable' using errcode = 'P0002';
  end if;

  if v_row.assigne_a is distinct from p_agent_id then
    raise exception 'Assignation non enregistrée' using errcode = '23505';
  end if;

  return v_row;
end;
$$;

revoke all on function public.assign_demande_client(uuid, uuid, text) from public;
grant execute on function public.assign_demande_client(uuid, uuid, text) to service_role;

-- Clean up failed assignment attempts again after debugging.
update public.demandes_clients
set
  statut = 'nouveau',
  archived_at = null,
  traitement_statut = null
where assigne_a is null
  and (archived_at is not null or traitement_statut is not null);

drop function if exists public.debug_demande_assign_write(uuid, uuid);
drop function if exists public.debug_demande_trigger_sources();
