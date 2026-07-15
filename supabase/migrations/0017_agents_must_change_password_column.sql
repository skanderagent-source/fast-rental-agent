-- Some shared Supabase projects used must_change_pass; Fast Rental expects must_change_password.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agents'
      and column_name = 'must_change_pass'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agents'
      and column_name = 'must_change_password'
  ) then
    alter table public.agents
      rename column must_change_pass to must_change_password;
  end if;
end
$$;

alter table public.agents
  add column if not exists must_change_password boolean not null default false;
