-- Read legacy trigger function bodies for demandes_clients protection.

create or replace function public.debug_demande_trigger_sources()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'protect_demande_fields', pg_get_functiondef('public.protect_demande_fields()'::regprocedure),
    'handle_demande_referral', pg_get_functiondef('public.handle_demande_referral()'::regprocedure)
  );
$$;

revoke all on function public.debug_demande_trigger_sources() from public;
grant execute on function public.debug_demande_trigger_sources() to service_role;
