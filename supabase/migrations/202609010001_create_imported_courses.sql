create extension if not exists pgcrypto;

create table if not exists public.imported_courses (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  code text,
  name text,
  section text,
  semester text,
  instructor text,
  extraction_status text not null
    check (extraction_status in ('success', 'partial', 'failed')),
  extraction_warnings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(extraction_warnings) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists imported_courses_user_id_idx
  on public.imported_courses (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists imported_courses_set_updated_at on public.imported_courses;
create trigger imported_courses_set_updated_at
before update on public.imported_courses
for each row execute function public.set_updated_at();

alter table public.imported_courses enable row level security;

create policy "Users can read their imported courses"
on public.imported_courses
for select
using ((select auth.jwt() ->> 'sub') = user_id);

create policy "Users can delete their imported courses"
on public.imported_courses
for delete
using ((select auth.jwt() ->> 'sub') = user_id);
