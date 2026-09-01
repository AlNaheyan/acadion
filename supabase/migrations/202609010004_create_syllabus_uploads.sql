create table if not exists public.syllabus_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  course_id uuid references public.imported_courses(id) on delete set null,
  file_name text not null,
  file_size integer not null check (file_size > 0 and file_size <= 10485760),
  mime_type text not null check (mime_type = 'application/pdf'),
  storage_key text,
  file_sha256 text check (file_sha256 is null or file_sha256 ~ '^[0-9a-f]{64}$'),
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'extracting', 'success', 'failed')),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint syllabus_uploads_failure_error
    check (extraction_status = 'failed' or error_code is null),
  constraint syllabus_uploads_success_course
    check (extraction_status <> 'success' or course_id is not null)
);

create index if not exists syllabus_uploads_user_id_idx
  on public.syllabus_uploads (user_id);
create index if not exists syllabus_uploads_course_id_idx
  on public.syllabus_uploads (course_id);

drop trigger if exists syllabus_uploads_set_updated_at on public.syllabus_uploads;
create trigger syllabus_uploads_set_updated_at
before update on public.syllabus_uploads
for each row execute function public.set_updated_at();

alter table public.syllabus_uploads enable row level security;

create policy "Users can read their syllabus uploads"
on public.syllabus_uploads
for select
using ((select auth.jwt() ->> 'sub') = user_id);

create policy "Users can delete their syllabus uploads"
on public.syllabus_uploads
for delete
using ((select auth.jwt() ->> 'sub') = user_id);
