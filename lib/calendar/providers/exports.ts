export interface CalendarExportClient {
  rpc(name: "claim_calendar_event", values: Record<string, unknown>): PromiseLike<{ data: boolean | null; error: { message: string } | null }>;
  from(table: "calendar_event_exports"): {
    upsert(values: Record<string, unknown>, options: { onConflict: string }): PromiseLike<{ error: { message: string } | null }>;
    update(values: Record<string, unknown>): { eq(column: string, value: string): { eq(column: string, value: string): PromiseLike<{ error: { message: string } | null }> } };
  };
}

export async function claimCalendarEvent(
  client: CalendarExportClient,
  value: { connectionId: string; courseId: string; sourceType: "class" | "assessment"; logicalKey: string },
): Promise<boolean> {
  const { data, error } = await client.rpc("claim_calendar_event", {
    p_connection_id: value.connectionId, p_course_id: value.courseId,
    p_source_type: value.sourceType, p_logical_key: value.logicalKey,
  });
  if (error) throw new Error("Calendar event could not be claimed.");
  return data === true;
}

export async function markCalendarEventFailed(client: CalendarExportClient, connectionId: string, logicalKey: string): Promise<void> {
  const { error } = await client.from("calendar_event_exports")
    .update({ status: "failed", last_error: "Provider operation failed.", provider_event_id: null })
    .eq("connection_id", connectionId).eq("logical_key", logicalKey);
  if (error) throw new Error("Calendar failure could not be saved.");
}

export async function saveCreatedCalendarEvent(
  client: CalendarExportClient,
  value: { connectionId: string; courseId: string; sourceType: "class" | "assessment"; logicalKey: string; providerEventId: string },
): Promise<void> {
  const { error } = await client.from("calendar_event_exports").upsert({
    connection_id: value.connectionId,
    course_id: value.courseId,
    source_type: value.sourceType,
    logical_key: value.logicalKey,
    provider_event_id: value.providerEventId,
    status: "created",
    last_error: null,
    attempt_count: 1,
  }, { onConflict: "connection_id,logical_key" });
  if (error) throw new Error("Calendar event record could not be saved.");
}
