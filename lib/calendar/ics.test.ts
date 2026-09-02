import { describe, expect, it } from "vitest";

import {
  escapeIcsText,
  foldIcsLine,
  serializeIcsCalendar,
  serializeIcsProperty,
} from "./ics";

describe("ICS serialization", () => {
  it("escapes RFC text delimiters and newlines", () => {
    expect(escapeIcsText("Room 1, West; bring \\ notes\r\nSecond line")).toBe(
      "Room 1\\, West\\; bring \\\\ notes\\nSecond line",
    );
    expect(
      serializeIcsProperty({
        name: "description",
        value: "First, second",
        valueType: "text",
      }),
    ).toBe("DESCRIPTION:First\\, second");
  });

  it("folds physical lines at 75 UTF-8 octets with continuation space", () => {
    const folded = foldIcsLine(`DESCRIPTION:${"é".repeat(50)}`);
    const physicalLines = folded.split("\r\n");

    expect(physicalLines.length).toBeGreaterThan(1);
    expect(physicalLines[1].startsWith(" ")).toBe(true);
    for (const line of physicalLines) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(folded.replaceAll("\r\n ", "")).toBe(
      `DESCRIPTION:${"é".repeat(50)}`,
    );
  });

  it("serializes a complete deterministic calendar with CRLF endings", () => {
    const calendar = serializeIcsCalendar({
      name: "ECO 20250, Fall",
      events: [
        [
          { name: "UID", value: "course-123@class.acadion" },
          { name: "DTSTAMP", value: "20260901T120000Z" },
          { name: "DTSTART", value: "20261001T093000" },
          { name: "SUMMARY", value: "Midterm; Exam", valueType: "text" },
        ],
      ],
    });

    expect(calendar).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n");
    expect(calendar).toContain("X-WR-CALNAME:ECO 20250\\, Fall\r\n");
    expect(calendar).toContain("DTSTAMP:20260901T120000Z\r\n");
    expect(calendar).toContain("SUMMARY:Midterm\\; Exam\r\n");
    expect(calendar.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(calendar.replaceAll("\r\n", "")).not.toContain("\n");
  });

  it("rejects unsafe property and parameter names", () => {
    expect(() =>
      serializeIcsProperty({ name: "SUMMARY\r\nBAD", value: "unsafe" }),
    ).toThrow("Invalid ICS property name");
    expect(() =>
      serializeIcsProperty({
        name: "DTSTART",
        value: "20260901T090000",
        parameters: { "TZID:BAD": "America/New_York" },
      }),
    ).toThrow("Invalid ICS parameter name");
  });
});
