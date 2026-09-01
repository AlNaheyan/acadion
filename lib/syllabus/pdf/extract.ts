import type { TextItem } from "pdfjs-dist/types/src/display/api";

export interface PdfTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  has_eol: boolean;
}

export interface PdfPageText {
  page: number;
  text: string;
  items: PdfTextItem[];
}

export class PdfExtractionError extends Error {
  constructor(message = "We could not read this PDF.", options?: ErrorOptions) {
    super(message, options);
    this.name = "PdfExtractionError";
  }
}

function isTextItem(item: unknown): item is TextItem {
  return typeof item === "object" && item !== null && "str" in item;
}

function mapTextItem(item: TextItem): PdfTextItem {
  return {
    text: item.str,
    x: Number(item.transform[4] ?? 0),
    y: Number(item.transform[5] ?? 0),
    width: item.width,
    height: item.height,
    has_eol: item.hasEOL,
  };
}

function joinTextItems(items: PdfTextItem[]): string {
  let text = "";

  for (const item of items) {
    text += item.text;
    text += item.has_eol ? "\n" : " ";
  }

  return text.replace(/[ \t]+\n/g, "\n").trim();
}

export async function extractPdfText(data: ArrayBuffer | Uint8Array): Promise<PdfPageText[]> {
  try {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const loadingTask = getDocument({ data: bytes, useSystemFonts: true });
    const document = await loadingTask.promise;

    try {
      const pages: PdfPageText[] = [];

      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent({ includeMarkedContent: false });
        const items = content.items.filter(isTextItem).map(mapTextItem);

        pages.push({
          page: pageNumber,
          text: joinTextItems(items),
          items,
        });
      }

      return pages;
    } finally {
      await loadingTask.destroy();
    }
  } catch (error) {
    if (error instanceof PdfExtractionError) throw error;
    throw new PdfExtractionError("We could not extract text from this PDF.", {
      cause: error,
    });
  }
}
