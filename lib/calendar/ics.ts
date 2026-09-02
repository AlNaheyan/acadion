export interface IcsProperty {
  name: string;
  value: string;
  valueType?: "raw" | "text";
  parameters?: Record<string, string>;
}

export interface IcsCalendarInput {
  name: string;
  events: IcsProperty[][];
  productId?: string;
}

const encoder = new TextEncoder();
const tokenPattern = /^[A-Z0-9-]+$/;

export function escapeIcsText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\r", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

function assertToken(value: string, label: string): string {
  const token = value.toUpperCase();
  if (!tokenPattern.test(token)) {
    throw new Error(`Invalid ICS ${label}.`);
  }
  return token;
}

function serializeParameters(parameters: Record<string, string> = {}): string {
  return Object.entries(parameters)
    .map(([name, value]) => {
      const token = assertToken(name, "parameter name");
      const safeValue = /^[A-Za-z0-9._+\/-]+$/.test(value)
        ? value
        : `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
      return `;${token}=${safeValue}`;
    })
    .join("");
}

export function serializeIcsProperty(property: IcsProperty): string {
  const name = assertToken(property.name, "property name");
  const value =
    property.valueType === "text"
      ? escapeIcsText(property.value)
      : property.value;
  return `${name}${serializeParameters(property.parameters)}:${value}`;
}

export function foldIcsLine(line: string): string {
  const segments: string[] = [];
  let segment = "";
  let segmentBytes = 0;
  let limit = 75;

  for (const character of line) {
    const characterBytes = encoder.encode(character).length;
    if (segment && segmentBytes + characterBytes > limit) {
      segments.push(segment);
      segment = "";
      segmentBytes = 0;
      limit = 74;
    }
    segment += character;
    segmentBytes += characterBytes;
  }

  if (segment || segments.length === 0) segments.push(segment);
  return segments.join("\r\n ");
}

function component(name: string, properties: IcsProperty[]): string[] {
  const componentName = assertToken(name, "component name");
  return [
    `BEGIN:${componentName}`,
    ...properties.map(serializeIcsProperty),
    `END:${componentName}`,
  ];
}

export function serializeIcsCalendar(input: IcsCalendarInput): string {
  const calendarProperties: IcsProperty[] = [
    { name: "VERSION", value: "2.0" },
    {
      name: "PRODID",
      value: input.productId ?? "-//Acadion//Syllabus Calendar//EN",
    },
    { name: "CALSCALE", value: "GREGORIAN" },
    { name: "METHOD", value: "PUBLISH" },
    { name: "X-WR-CALNAME", value: input.name, valueType: "text" },
  ];
  const lines = [
    "BEGIN:VCALENDAR",
    ...calendarProperties.map(serializeIcsProperty),
    ...input.events.flatMap((event) => component("VEVENT", event)),
    "END:VCALENDAR",
  ];

  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
