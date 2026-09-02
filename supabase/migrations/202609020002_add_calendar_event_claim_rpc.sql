create or replace function public.claim_calendar_event(
  p_connection_id uuid, p_course_id uuid, p_source_type text, p_logical_key text
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_claimed boolean := false;
begin
  insert into public.calendar_event_exports (connection_id, course_id, source_type, logical_key, status, attempt_count)
  values (p_connection_id, p_course_id, p_source_type, p_logical_key, 'pending', 1)
  on conflict (connection_id, logical_key) do update
    set status = 'pending', last_error = null, attempt_count = calendar_event_exports.attempt_count + 1
    where calendar_event_exports.status = 'failed';
  get diagnostics v_claimed = row_count;
  return v_claimed;
end;
$$;
revoke all on function public.claim_calendar_event(uuid, uuid, text, text) from public, anon, authenticated;
