create table if not exists public.course_assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.imported_courses(id) on delete cascade,
  external_id text not null,
  type text not null check (
    type in ('homework', 'quiz', 'midterm', 'exam', 'final_exam', 'project', 'lab', 'paper', 'presentation', 'other')
  ),
  title text not null,
  release_date date,
  due_date date,
  event_date date,
  due_time time,
  start_time time,
  end_time time,
  location text,
  coverage text,
  date_status text not null
    check (date_status in ('confirmed', 'TBD', 'ambiguous', 'missing')),
  raw_date_text text,
  source_page integer check (source_page is null or source_page > 0),
  source_text text check (source_text is null or char_length(source_text) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, external_id),
  constraint course_assessments_due_time_requires_date
    check (due_time is null or due_date is not null),
  constraint course_assessments_event_times_require_date
    check ((start_time is null and end_time is null) or event_date is not null),
  constraint course_assessments_end_requires_start
    check (end_time is null or start_time is not null),
  constraint course_assessments_time_range
    check (start_time is null or end_time is null or start_time < end_time),
  constraint course_assessments_status_dates
    check (
      (date_status = 'confirmed' and (release_date is not null or due_date is not null or event_date is not null))
      or
      (date_status <> 'confirmed' and release_date is null and due_date is null and event_date is null)
    )
);

create index if not exists course_assessments_course_id_idx
  on public.course_assessments (course_id);
create index if not exists course_assessments_calendar_idx
  on public.course_assessments (course_id, date_status, due_date, event_date);

drop trigger if exists course_assessments_set_updated_at on public.course_assessments;
create trigger course_assessments_set_updated_at
before update on public.course_assessments
for each row execute function public.set_updated_at();

alter table public.course_assessments enable row level security;

create policy "Users can read assessments for their imported courses"
on public.course_assessments
for select
using (
  exists (
    select 1 from public.imported_courses
    where imported_courses.id = course_assessments.course_id
      and imported_courses.user_id = (select auth.jwt() ->> 'sub')
  )
);

create table if not exists public.assessment_rules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.imported_courses(id) on delete cascade,
  type text not null check (
    type in ('homework', 'quiz', 'midterm', 'exam', 'final_exam', 'project', 'lab', 'paper', 'presentation', 'other')
  ),
  rule text not null,
  source_page integer check (source_page is null or source_page > 0),
  source_text text check (source_text is null or char_length(source_text) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists assessment_rules_course_id_idx
  on public.assessment_rules (course_id);

alter table public.assessment_rules enable row level security;

create policy "Users can read rules for their imported courses"
on public.assessment_rules
for select
using (
  exists (
    select 1 from public.imported_courses
    where imported_courses.id = assessment_rules.course_id
      and imported_courses.user_id = (select auth.jwt() ->> 'sub')
  )
);
