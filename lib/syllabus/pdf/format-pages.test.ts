import { describe, expect, it } from "vitest";

import type { PdfPageText, PdfTextItem } from "./extract";
import { formatPdfPage, formatPdfPagesForExtraction } from "./format-pages";

function item(text: string, x: number, y: number, width = 30): PdfTextItem {
  return { text, x, y, width, height: 12, has_eol: false };
}

describe("formatPdfPage", () => {
  it("reconstructs rows and visible table columns from shuffled items", () => {
    const page: PdfPageText = {
      page: 1,
      text: "",
      items: [
        item("9/16", 220, 680),
        item("Due Date", 220, 700, 48),
        item("Homework 1", 72, 680, 72),
        item("Assessment", 72, 700, 65),
      ],
    };

    expect(formatPdfPage(page)).toBe(
      "Assessment | Due Date\nHomework 1 | 9/16",
    );
  });

  it("joins nearby fragments as ordinary line text", () => {
    const page: PdfPageText = {
      page: 1,
      text: "",
      items: [item("Intermediate", 72, 700, 68), item("Microeconomics", 145, 700, 84)],
    };

    expect(formatPdfPage(page)).toBe("Intermediate Microeconomics");
  });

  it("groups small vertical coordinate variations into one row", () => {
    const page: PdfPageText = {
      page: 1,
      text: "",
      items: [item("Midterm", 72, 700), item("October 1", 180, 698.5)],
    };

    expect(formatPdfPage(page)).toBe("Midterm | October 1");
  });

  it("falls back to normalized line-preserving page text", () => {
    const page: PdfPageText = {
      page: 1,
      text: "Homework 1\t  9/9\r\nHomework 2    9/16",
      items: [],
    };

    expect(formatPdfPage(page)).toBe("Homework 1 9/9\nHomework 2 9/16");
  });
});

describe("formatPdfPagesForExtraction", () => {
  it("preserves explicit page boundaries", () => {
    const pages: PdfPageText[] = [
      { page: 1, text: "Course information", items: [] },
      { page: 2, text: "Assessment schedule", items: [] },
    ];

    expect(formatPdfPagesForExtraction(pages)).toBe(
      "--- PAGE 1 ---\nCourse information\n\n--- PAGE 2 ---\nAssessment schedule",
    );
  });

  it("keeps an empty page marker for source-page fidelity", () => {
    expect(
      formatPdfPagesForExtraction([{ page: 3, text: "", items: [] }]),
    ).toBe("--- PAGE 3 ---");
  });
});
