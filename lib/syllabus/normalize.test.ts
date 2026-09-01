import { describe, expect, it } from "vitest";

import { normalizeDate, normalizeTime, normalizeTimeRange } from "./normalize";

describe("normalizeDate", () => {
  it.each([
    ["Oct. 1", 2026, "2026-10-01"],
    ["10/1", 2026, "2026-10-01"],
    ["October 1, 2026", undefined, "2026-10-01"],
    ["2026-10-01", undefined, "2026-10-01"],
  ])("normalizes %s", (input, year, expected) => {
    expect(normalizeDate(input, year)).toMatchObject({
      value: expected,
      status: "confirmed",
    });
  });

  it.each([
    [null, "missing"],
    ["", "missing"],
    ["TBD", "TBD"],
    ["Oct. 1", "ambiguous"],
    ["second week of October", "ambiguous"],
    ["February 30, 2026", "ambiguous"],
  ])("preserves unresolved date %s as %s", (input, status) => {
    expect(normalizeDate(input)).toMatchObject({ value: null, status });
  });
});

describe("normalizeTime", () => {
  it.each([
    ["8pm", "20:00"],
    ["11:59 PM", "23:59"],
    ["12 AM", "00:00"],
    ["12:15 pm", "12:15"],
    ["9:05", "09:05"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeTime(input)).toMatchObject({
      value: expected,
      status: "confirmed",
    });
  });

  it.each([
    [null, "missing"],
    ["TBD", "TBD"],
    ["8", "ambiguous"],
    ["25:00", "ambiguous"],
  ])("preserves unresolved time %s as %s", (input, status) => {
    expect(normalizeTime(input)).toMatchObject({ value: null, status });
  });
});

describe("normalizeTimeRange", () => {
  it.each([
    ["11 – 12:15 PM", "11:00", "12:15"],
    ["1 - 2 PM", "13:00", "14:00"],
    ["9:30 AM - 10:45 AM", "09:30", "10:45"],
    ["13:00-14:15", "13:00", "14:15"],
  ])("normalizes %s", (input, start, end) => {
    expect(normalizeTimeRange(input)).toEqual({
      start_time: start,
      end_time: end,
      status: "confirmed",
      raw_text: input,
    });
  });

  it.each(["11 - 10 AM", "11 - 12", "sometime after lunch"])(
    "does not guess ambiguous range %s",
    (input) => {
      expect(normalizeTimeRange(input)).toMatchObject({
        start_time: null,
        end_time: null,
        status: "ambiguous",
      });
    },
  );
});
