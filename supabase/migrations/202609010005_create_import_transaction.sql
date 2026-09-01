create or replace function public.import_syllabus(
  p_user_id text,
  p_file_name text,
  p_file_size integer,
  p_storage_key text,
  p_file_sha256 text,
  p_extraction jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_course_id uuid;
  v_meeting jsonb;
  v_assessment jsonb;
  v_rule jsonb;
  v_request_user text := auth.jwt() ->> 'sub';
begin
  if auth.role() <> 'service_role' and v_request_user is distinct from p_user_id then
    raise exception 'not authorized to import for this user' using errcode = '42501';
  end if;

  insert into public.imported_courses (
    user_id,
    code,
    name,
    section,
    semester,
    instructor,
    extraction_status,
    extraction_warnings
  ) values (
    p_user_id,
    nullif(p_extraction -> 'course' ->> 'code', ''),
    nullif(p_extraction -> 'course' ->> 'name', ''),
    nullif(p_extraction -> 'course' ->> 'section', ''),
    nullif(p_extraction -> 'course' ->> 'semester', ''),
    nullif(p_extraction -> 'course' ->> 'instructor', ''),
    p_extraction -> 'metadata' ->> 'extraction_status',
    coalesce(p_extraction -> 'metadata' -> 'warnings', '[]'::jsonb)
  )
  returning id into v_course_id;

  for v_meeting in
    select value from jsonb_array_elements(coalesce(p_extraction -> 'meetings', '[]'::jsonb))
  loop
    insert into public.course_meetings (
      course_id, day, start_time, end_time, location, start_date, end_date
    )
    select
      v_course_id,
      day.value,
      nullif(v_meeting ->> 'start_time', '')::time,
      nullif(v_meeting ->> 'end_time', '')::time,
      nullif(v_meeting ->> 'location', ''),
      nullif(v_meeting ->> 'start_date', '')::date,
      nullif(v_meeting ->> 'end_date', '')::date
    from jsonb_array_elements_text(coalesce(v_meeting -> 'days', '[]'::jsonb)) as day(value);
  end loop;

  for v_assessment in
    select value from jsonb_array_elements(coalesce(p_extraction -> 'assessments', '[]'::jsonb))
  loop
    insert into public.course_assessments (
      course_id,
      external_id,
      type,
      title,
      release_date,
      due_date,
      event_date,
      due_time,
      start_time,
      end_time,
      location,
      coverage,
      date_status,
      raw_date_text,
      source_page,
      source_text
    ) values (
      v_course_id,
      v_assessment ->> 'id',
      v_assessment ->> 'type',
      v_assessment ->> 'title',
      nullif(v_assessment ->> 'release_date', '')::date,
      nullif(v_assessment ->> 'due_date', '')::date,
      nullif(v_assessment ->> 'date', '')::date,
      nullif(v_assessment ->> 'due_time', '')::time,
      nullif(v_assessment ->> 'start_time', '')::time,
      nullif(v_assessment ->> 'end_time', '')::time,
      nullif(v_assessment ->> 'location', ''),
      nullif(v_assessment ->> 'coverage', ''),
      v_assessment ->> 'date_status',
      nullif(v_assessment ->> 'raw_date_text', ''),
      nullif(v_assessment -> 'source' ->> 'page', '')::integer,
      nullif(v_assessment -> 'source' ->> 'text', '')
    );
  end loop;

  for v_rule in
    select value from jsonb_array_elements(coalesce(p_extraction -> 'assessment_rules', '[]'::jsonb))
  loop
    insert into public.assessment_rules (
      course_id, type, rule, source_page, source_text
    ) values (
      v_course_id,
      v_rule ->> 'type',
      v_rule ->> 'rule',
      nullif(v_rule -> 'source' ->> 'page', '')::integer,
      nullif(v_rule -> 'source' ->> 'text', '')
    );
  end loop;

  insert into public.syllabus_uploads (
    user_id,
    course_id,
    file_name,
    file_size,
    mime_type,
    storage_key,
    file_sha256,
    extraction_status
  ) values (
    p_user_id,
    v_course_id,
    p_file_name,
    p_file_size,
    'application/pdf',
    p_storage_key,
    p_file_sha256,
    'success'
  );

  return v_course_id;
end;
$$;

revoke all on function public.import_syllabus(text, text, integer, text, text, jsonb) from public;
grant execute on function public.import_syllabus(text, text, integer, text, text, jsonb)
  to authenticated, service_role;
