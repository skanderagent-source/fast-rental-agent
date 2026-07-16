-- Short-lived, single-use confirmation tokens for destructive/sensitive API actions.
-- Only the service-role backend can access this table.

create table if not exists public.security_action_tokens (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (char_length(action) between 1 and 64),
  target_id text not null default '' check (char_length(target_id) <= 128),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists security_action_tokens_user_expiry_idx
  on public.security_action_tokens (user_id, expires_at);

alter table public.security_action_tokens enable row level security;
revoke all on table public.security_action_tokens from anon, authenticated;

comment on table public.security_action_tokens is
  'Hashed, user/action/target-bound one-time confirmations issued by the Fast Rental API.';
