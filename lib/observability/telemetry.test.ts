import { describe, expect, it, vi } from "vitest";
import { createTelemetryRecord, emitTelemetry } from "./telemetry";
describe("privacy-safe telemetry", () => {
  it("keeps allowlisted metrics and drops sensitive or identifying fields", () => {
    const record = createTelemetryRecord("syllabus_import", { outcome: "success", duration_ms: 120, filename: "secret.pdf", user_id: "user", syllabus_text: "private" }, new Date("2026-09-02T00:00:00Z"));
    expect(record).toEqual({ event: "syllabus_import", timestamp: "2026-09-02T00:00:00.000Z", outcome: "success", duration_ms: 120 });
  });
  it("emits one JSON record", () => { const sink = vi.fn(); emitTelemetry("calendar_export", { provider: "ics", created_count: 2 }, sink); expect(JSON.parse(sink.mock.calls[0][0])).toMatchObject({ event: "calendar_export", provider: "ics", created_count: 2 }); });
});
