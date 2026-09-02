export interface IcsValidationResult {
  valid: boolean;
  issues: string[];
  eventCount: number;
}

interface ParsedProperty {
  name: string;
  parameters: Map<string, string>;
  value: string;
}

const encoder = new TextEncoder();

function unfold(content: string): string[] {
  return content
    .slice(0, -2)
    .split("\r\n")
    .reduce<string[]>((lines, line) => {
      if (/^[ \t]/.test(line) && lines.length > 0) {
        lines[lines.length - 1] += line.slice(1);
      } else {
        lines.push(line);
      }
      return lines;
    }, []);
}

function parseProperty(line: string): ParsedProperty | null {
  const colon = line.indexOf(":");
  if (colon <= 0) return null;
  const [name, ...parameterParts] = line.slice(0, colon).split(";");
  const parameters = new Map<string, string>();

  for (const part of parameterParts) {
    const equals = part.indexOf("=");
    if (equals <= 0) return null;
    parameters.set(part.slice(0, equals), part.slice(equals + 1));
  }

  return { name, parameters, value: line.slice(colon + 1) };
}

function validateDateProperty(
  property: ParsedProperty,
  issues: string[],
): void {
  const valueType = property.parameters.get("VALUE");
  const timezone = property.parameters.get("TZID");

  if (valueType === "DATE") {
    if (!/^\d{8}$/.test(property.value)) {
      issues.push(`${property.name} has an invalid DATE value.`);
    }
    return;
  }
  if (timezone) {
    if (!/^\d{8}T\d{6}$/.test(property.value)) {
      issues.push(`${property.name} has an invalid local date-time.`);
    }
    return;
  }
  if (!/^\d{8}T\d{6}Z?$/.test(property.value)) {
    issues.push(`${property.name} has an invalid date-time.`);
  }
}

export function validateIcsCalendar(content: string): IcsValidationResult {
  const issues: string[] = [];
  if (!content.endsWith("\r\n")) issues.push("Calendar must end with CRLF.");
  if (content.replaceAll("\r\n", "").includes("\n")) {
    issues.push("Calendar contains a bare LF line ending.");
  }
  if (content.replaceAll("\r\n", "").includes("\r")) {
    issues.push("Calendar contains a bare CR line ending.");
  }

  const physicalLines = content.endsWith("\r\n")
    ? content.slice(0, -2).split("\r\n")
    : content.split(/\r?\n/);
  physicalLines.forEach((line, index) => {
    if (encoder.encode(line).length > 75) {
      issues.push(`Physical line ${index + 1} exceeds 75 octets.`);
    }
  });

  const lines = content.endsWith("\r\n") ? unfold(content) : physicalLines;
  const stack: string[] = [];
  const events: ParsedProperty[][] = [];
  let currentEvent: ParsedProperty[] | null = null;
  const calendarProperties: ParsedProperty[] = [];

  for (const line of lines) {
    if (line.startsWith("BEGIN:")) {
      const name = line.slice(6);
      stack.push(name);
      if (name === "VEVENT") currentEvent = [];
      continue;
    }
    if (line.startsWith("END:")) {
      const name = line.slice(4);
      if (stack.pop() !== name) issues.push(`Unbalanced END:${name}.`);
      if (name === "VEVENT" && currentEvent) {
        events.push(currentEvent);
        currentEvent = null;
      }
      continue;
    }

    const property = parseProperty(line);
    if (!property) {
      issues.push(`Invalid content line: ${line.slice(0, 40)}.`);
      continue;
    }
    if (currentEvent) currentEvent.push(property);
    else if (stack.at(-1) === "VCALENDAR") calendarProperties.push(property);
  }

  if (stack.length > 0) issues.push("Calendar contains unclosed components.");
  if (lines[0] !== "BEGIN:VCALENDAR" || lines.at(-1) !== "END:VCALENDAR") {
    issues.push("VCALENDAR must be the document root.");
  }
  if (!calendarProperties.some((property) => property.name === "VERSION" && property.value === "2.0")) {
    issues.push("Calendar is missing VERSION:2.0.");
  }
  if (!calendarProperties.some((property) => property.name === "PRODID" && property.value)) {
    issues.push("Calendar is missing PRODID.");
  }

  const uids = new Set<string>();
  events.forEach((event, index) => {
    const eventNumber = index + 1;
    for (const required of ["UID", "DTSTAMP", "DTSTART", "SUMMARY"]) {
      if (!event.some((property) => property.name === required && property.value)) {
        issues.push(`Event ${eventNumber} is missing ${required}.`);
      }
    }
    const uid = event.find((property) => property.name === "UID")?.value;
    if (uid) {
      if (uids.has(uid)) issues.push(`Event ${eventNumber} has a duplicate UID.`);
      uids.add(uid);
    }
    event
      .filter((property) => property.name === "DTSTART" || property.name === "DTEND")
      .forEach((property) => validateDateProperty(property, issues));

    const recurrence = event.find((property) => property.name === "RRULE");
    if (recurrence) {
      const parts = new Map(
        recurrence.value.split(";").map((part) => {
          const [name, value] = part.split("=", 2);
          return [name, value];
        }),
      );
      if (parts.get("FREQ") !== "WEEKLY") {
        issues.push(`Event ${eventNumber} recurrence is not weekly.`);
      }
      if (!/^(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*$/.test(parts.get("BYDAY") ?? "")) {
        issues.push(`Event ${eventNumber} recurrence has invalid BYDAY.`);
      }
      if (!/^\d{8}T\d{6}Z$/.test(parts.get("UNTIL") ?? "")) {
        issues.push(`Event ${eventNumber} recurrence has invalid UNTIL.`);
      }
    }
  });

  return { valid: issues.length === 0, issues, eventCount: events.length };
}
