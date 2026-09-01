import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { PdfPageText } from "../pdf";
import { validateCourseExtraction } from "../validate";
import { extractSyllabus } from "./service";

interface ExtractionFixture {
  name: string;
  pages: Array<{ page: number; text: string }>;
  expected: Record<string, unknown>;
}

const fixtureDirectory = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "syllabi",
);

async function loadFixtures(): Promise<ExtractionFixture[]> {
  const files = (await readdir(fixtureDirectory))
    .filter((file) => file.endsWith(".json"))
    .sort();

  return Promise.all(
    files.map(async (file) =>
      JSON.parse(await readFile(path.join(fixtureDirectory, file), "utf8")),
    ),
  );
}

describe("syllabus extraction regression fixtures", async () => {
  const fixtures = await loadFixtures();

  it("contains every required representative scenario", () => {
    expect(fixtures.map((fixture) => fixture.name)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("homework table"),
        expect.stringContaining("final exam TBD"),
        expect.stringContaining("multiple class meeting"),
        expect.stringContaining("conflicting assessment dates"),
      ]),
    );
  });

  it.each(await loadFixtures())("validates and extracts $name", async (fixture) => {
    const initialValidation = validateCourseExtraction(fixture.expected);
    expect(initialValidation.success).toBe(true);

    const pages: PdfPageText[] = fixture.pages.map((page) => ({ ...page, items: [] }));
    let capturedInput = "";
    const result = await extractSyllabus(pages, {
      extractStructured: async (prompt) => {
        capturedInput = prompt.input;
        return fixture.expected;
      },
    });

    expect(result.course).toMatchObject(
      (fixture.expected.course ?? {}) as Record<string, unknown>,
    );
    expect(result.meetings).toHaveLength(
      ((fixture.expected.meetings as unknown[]) ?? []).length,
    );
    expect(result.assessments.map(({ id, type, date_status }) => ({ id, type, date_status })))
      .toEqual(
        ((fixture.expected.assessments as Array<Record<string, unknown>>) ?? []).map(
          ({ id, type, date_status }) => ({ id, type, date_status }),
        ),
      );
    expect(capturedInput).toContain(`--- PAGE ${fixture.pages[0].page} ---`);
  });
});
