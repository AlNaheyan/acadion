import { createHash } from "node:crypto";

export type CalendarEventKind = "class" | "assessment";

export function createCalendarEventUid(
  courseId: string,
  kind: CalendarEventKind,
  eventId: string,
): string {
  const digest = createHash("sha256")
    .update(courseId)
    .update("\0")
    .update(kind)
    .update("\0")
    .update(eventId)
    .digest("hex")
    .slice(0, 32);

  return `${kind}-${digest}@calendar.acadion`;
}
