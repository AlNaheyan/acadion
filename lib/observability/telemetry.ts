export type TelemetryEvent = "syllabus_import" | "calendar_export";
type SafeValue = string | number | boolean;

const allowedFields: Record<TelemetryEvent, Set<string>> = {
  syllabus_import: new Set(["outcome", "duration_ms", "page_count", "meeting_count", "assessment_count", "warning_count", "error_code"]),
  calendar_export: new Set(["outcome", "duration_ms", "provider", "export_type", "created_count", "failed_count", "skipped_count", "excluded_count", "error_code"]),
};

export interface TelemetryRecord { event: TelemetryEvent; timestamp: string; [key: string]: SafeValue }

export function createTelemetryRecord(event: TelemetryEvent, fields: Record<string, unknown>, now = new Date()): TelemetryRecord {
  const record: TelemetryRecord = { event, timestamp: now.toISOString() };
  for (const [key, value] of Object.entries(fields)) {
    if (allowedFields[event].has(key) && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")) record[key] = value;
  }
  return record;
}

export function emitTelemetry(event: TelemetryEvent, fields: Record<string, unknown>, sink: (line: string) => void = console.info): void {
  if (process.env.NODE_ENV === "test" && sink === console.info) return;
  sink(JSON.stringify(createTelemetryRecord(event, fields)));
}
