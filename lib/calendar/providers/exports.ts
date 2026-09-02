export interface CalendarExportClient {
  from(table: "calendar_event_exports"): {
    insert(values: Record<string, unknown>): PromiseLike<{ error: { message: string; code?: string } | null }>;
    upsert(values: Record<string, unknown>, options: { onConflict: string }): PromiseLike<{ error: { message: string } | null }>;
  };
}

export async function claimCalendarEvent(
  client: CalendarExportClient,
  value: { connectionId: string; courseId: string; sourceType: "class" | "assessment"; logicalKey: string },
): Promise<boolean> {
  const { error } = await client.from("calendar_event_exports").insert({
    connection_id: value.connectionId, course_id: value.courseId, source_type: value.sourceType,
    logical_key: value.logicalKey, status: "pending", attempt_count: 1,
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error("Calendar event could not be claimed.");
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
