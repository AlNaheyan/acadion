create table if not exists public.course_meetings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.imported_courses(id) on delete cascade,
  day text not null
    check (day in ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY')),
  start_time time,
  end_time time,
  location text,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_meetings_time_range
    check (start_time is null or end_time is null or start_time < end_time),
  constraint course_meetings_date_range
    check (start_date is null or end_date is null or start_date <= end_date)
);

create index if not exists course_meetings_course_id_idx
  on public.course_meetings (course_id);

drop trigger if exists course_meetings_set_updated_at on public.course_meetings;
create trigger course_meetings_set_updated_at
before update on public.course_meetings
for each row execute function public.set_updated_at();

alter table public.course_meetings enable row level security;

create policy "Users can read meetings for their imported courses"
on public.course_meetings
for select
using (
  exists (
    select 1
    from public.imported_courses
    where imported_courses.id = course_meetings.course_id
      and imported_courses.user_id = (select auth.jwt() ->> 'sub')
  )
);
