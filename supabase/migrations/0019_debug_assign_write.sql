-- Diagnostic helper (safe to keep): inspect assignment column metadata and
-- whether a security-definer update can persist assigne_a.

create or replace function public.debug_demande_assign_write(
  p_lead_id uuid,
  p_agent_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_generated text;
  v_before uuid;
  v_after uuid;
  v_triggers jsonb;
begin
  select c.is_generated
  into v_generated
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'demandes_clients'
    and c.column_name = 'assigne_a';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', t.tgname,
        'timing', case t.tgtype & 66 when 2 then 'before' when 64 then 'instead of' else 'after' end,
        'events', trim(both ',' from concat(
          case when t.tgtype & 4 = 4 then 'insert,' else '' end,
          case when t.tgtype & 8 = 8 then 'delete,' else '' end,
          case when t.tgtype & 16 = 16 then 'update,' else '' end
        )),
        'definition', pg_get_triggerdef(t.oid)
      )
    ),
    '[]'::jsonb
  )
  into v_triggers
  from pg_trigger t
  where t.tgrelid = 'public.demandes_clients'::regclass
    and not t.tgisinternal;

  select assigne_a into v_before from public.demandes_clients where id = p_lead_id;

  update public.demandes_clients
  set assigne_a = p_agent_id
  where id = p_lead_id;

  select assigne_a into v_after from public.demandes_clients where id = p_lead_id;

  return jsonb_build_object(
    'assigne_a_is_generated', v_generated,
    'assigne_a_before', v_before,
    'assigne_a_after', v_after,
    'triggers', v_triggers
  );
end;
$$;

revoke all on function public.debug_demande_assign_write(uuid, uuid) from public;
grant execute on function public.debug_demande_assign_write(uuid, uuid) to service_role;
