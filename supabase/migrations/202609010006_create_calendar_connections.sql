create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  provider text not null check (provider in ('google', 'microsoft')),
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  token_expires_at timestamptz not null,
  scopes text[] not null default '{}',
  selected_calendar_id text,
  selected_calendar_name text,
  selected_calendar_timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists calendar_connections_user_provider_idx
  on public.calendar_connections (user_id, provider);

drop trigger if exists calendar_connections_set_updated_at on public.calendar_connections;
create trigger calendar_connections_set_updated_at
before update on public.calendar_connections
for each row execute function public.set_updated_at();

alter table public.calendar_connections enable row level security;

create policy "Users can read their calendar connection metadata"
on public.calendar_connections
for select
using ((select auth.jwt() ->> 'sub') = user_id);

create policy "Users can delete their calendar connections"
on public.calendar_connections
for delete
using ((select auth.jwt() ->> 'sub') = user_id);

revoke all on public.calendar_connections from anon, authenticated;
grant select (
  id, user_id, provider, token_expires_at, scopes,
  selected_calendar_id, selected_calendar_name, selected_calendar_timezone,
  created_at, updated_at
) on public.calendar_connections to authenticated;
grant delete on public.calendar_connections to authenticated;
