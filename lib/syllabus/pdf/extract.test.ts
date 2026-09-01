import { describe, expect, it } from "vitest";

import { extractPdfText, PdfExtractionError } from "./extract";

function createTextPdf(pageTexts: string[]): Uint8Array {
  const objects: string[] = [];
  const pageIds = pageTexts.map((_, index) => 3 + index * 2);
  const contentIds = pageTexts.map((_, index) => 4 + index * 2);
  const fontId = 3 + pageTexts.length * 2;

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageTexts.length} >>`;

  pageTexts.forEach((text, index) => {
    const escaped = text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
    const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
    objects[pageIds[index]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentIds[index]} 0 R >>`;
    objects[contentIds[index]] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let pdf = "%PDF-1.7\n";
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

describe("extractPdfText", () => {
  it("extracts text page-by-page in source order", async () => {
    const pages = await extractPdfText(
      createTextPdf(["Course: ECO 20250", "Midterm: October 1"]),
    );

    expect(pages.map(({ page, text }) => ({ page, text }))).toEqual([
      { page: 1, text: "Course: ECO 20250" },
      { page: 2, text: "Midterm: October 1" },
    ]);
    expect(pages[0].items[0]).toMatchObject({
      text: "Course: ECO 20250",
      x: 72,
      y: 720,
    });
  });

  it("accepts an ArrayBuffer", async () => {
    const bytes = createTextPdf(["Syllabus"]);
    const buffer = new Uint8Array(bytes).buffer as ArrayBuffer;

    await expect(extractPdfText(buffer)).resolves.toMatchObject([
      { page: 1, text: "Syllabus" },
    ]);
  });

  it("returns a stable extraction error for malformed data", async () => {
    await expect(extractPdfText(new TextEncoder().encode("not a pdf"))).rejects.toBeInstanceOf(
      PdfExtractionError,
    );
  });
});
