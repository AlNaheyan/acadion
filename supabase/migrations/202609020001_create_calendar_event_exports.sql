create table if not exists public.calendar_event_exports (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.calendar_connections(id) on delete cascade,
  course_id uuid not null references public.imported_courses(id) on delete cascade,
  source_type text not null check (source_type in ('class', 'assessment')),
  logical_key text not null,
  provider_event_id text,
  status text not null default 'pending' check (status in ('pending', 'created', 'failed')),
  last_error text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, logical_key)
);

create index if not exists calendar_event_exports_course_idx
  on public.calendar_event_exports (course_id, source_type);

drop trigger if exists calendar_event_exports_set_updated_at on public.calendar_event_exports;
create trigger calendar_event_exports_set_updated_at
before update on public.calendar_event_exports
for each row execute function public.set_updated_at();

alter table public.calendar_event_exports enable row level security;

create policy "Users can read their calendar export records"
on public.calendar_event_exports
for select
using (
  exists (
    select 1 from public.imported_courses
    where imported_courses.id = calendar_event_exports.course_id
      and imported_courses.user_id = (select auth.jwt() ->> 'sub')
  )
);

grant select on public.calendar_event_exports to authenticated;
