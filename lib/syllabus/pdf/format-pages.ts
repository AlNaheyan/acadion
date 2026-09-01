import type { PdfPageText, PdfTextItem } from "./extract";

export interface FormatPdfPagesOptions {
  rowTolerance?: number;
  columnGap?: number;
}

const defaults: Required<FormatPdfPagesOptions> = {
  rowTolerance: 2.5,
  columnGap: 18,
};

function normalizeFallbackText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function groupRows(items: PdfTextItem[], rowTolerance: number): PdfTextItem[][] {
  const rows: Array<{ y: number; items: PdfTextItem[] }> = [];

  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    if (!item.text.trim()) continue;

    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= rowTolerance);
    if (row) {
      row.items.push(item);
      row.y = (row.y * (row.items.length - 1) + item.y) / row.items.length;
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => row.items.sort((a, b) => a.x - b.x));
}

function formatRow(items: PdfTextItem[], columnGap: number): string {
  let line = "";
  let previousEnd: number | null = null;

  for (const item of items) {
    const text = item.text.replace(/\s+/g, " ").trim();
    if (!text) continue;

    if (line && previousEnd != null) {
      const gap = item.x - previousEnd;
      line += gap >= columnGap ? " | " : " ";
    }

    line += text;
    previousEnd = item.x + Math.max(item.width, 0);
  }

  return line.trim();
}

export function formatPdfPage(
  page: PdfPageText,
  options: FormatPdfPagesOptions = {},
): string {
  const settings = { ...defaults, ...options };
  if (page.items.length === 0) return normalizeFallbackText(page.text);

  return groupRows(page.items, settings.rowTolerance)
    .map((row) => formatRow(row, settings.columnGap))
    .filter(Boolean)
    .join("\n");
}

export function formatPdfPagesForExtraction(
  pages: PdfPageText[],
  options: FormatPdfPagesOptions = {},
): string {
  return pages
    .map((page) => `--- PAGE ${page.page} ---\n${formatPdfPage(page, options)}`.trimEnd())
    .join("\n\n");
}
