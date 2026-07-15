-- Production Orcha schema blocks PostgREST writes to assigne_a / assigne_nom /
-- assigne_le (updates archive the row but leave assignee null). Use a
-- SECURITY DEFINER RPC so Fast Rental can assign leads reliably.

-- Re-open leads stuck after failed assignment attempts.
update public.demandes_clients
set
  statut = 'nouveau',
  archived_at = null,
  traitement_statut = null
where assigne_a is null
  and (archived_at is not null or traitement_statut is not null);

grant update (
  assigne_a,
  assigne_nom,
  assigne_le,
  ref_agent_id,
  assignation_type,
  archived_at,
  traitement_statut,
  delete_after,
  statut
)
on table public.demandes_clients
to service_role;

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
