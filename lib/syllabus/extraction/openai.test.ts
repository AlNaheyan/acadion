import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";

import type { CourseExtraction } from "../schema";
import {
  DEFAULT_SYLLABUS_MODEL,
  requestStructuredSyllabusExtraction,
  StructuredExtractionError,
} from "./openai";

const prompt = {
  instructions: "Extract syllabus data.",
  input: "<syllabus_document>Course text</syllabus_document>",
};

const extraction: CourseExtraction = {
  course: {
    name: "Microeconomics",
    code: "ECO 20250",
    section: null,
    semester: "Fall 2026",
    instructor: null,
  },
  meetings: [],
  assessments: [],
  assessment_rules: [],
  metadata: {
    source_type: "syllabus",
    extraction_status: "success",
    warnings: [],
  },
};

function mockClient(output: CourseExtraction | null): {
  client: OpenAI;
  parse: ReturnType<typeof vi.fn>;
} {
  const parse = vi.fn().mockResolvedValue({ output_parsed: output });
  return {
    client: { responses: { parse } } as unknown as OpenAI,
    parse,
  };
}

describe("requestStructuredSyllabusExtraction", () => {
  it("uses Responses structured output with the canonical strict schema", async () => {
    const { client, parse } = mockClient(extraction);

    await expect(
      requestStructuredSyllabusExtraction(prompt, { client }),
    ).resolves.toEqual(extraction);

    expect(parse).toHaveBeenCalledOnce();
    const request = parse.mock.calls[0][0];
    expect(request).toMatchObject({
      model: DEFAULT_SYLLABUS_MODEL,
      store: false,
      input: [
        { role: "system", content: prompt.instructions },
        { role: "user", content: prompt.input },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "syllabus_extraction",
          strict: true,
        },
      },
    });
  });

  it("supports an explicit model override", async () => {
    const { client, parse } = mockClient(extraction);
    await requestStructuredSyllabusExtraction(prompt, { client, model: "test-model" });
    expect(parse.mock.calls[0][0].model).toBe("test-model");
  });

  it("fails clearly when no API key or client is configured", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      await expect(requestStructuredSyllabusExtraction(prompt)).rejects.toMatchObject({
        code: "MISSING_API_KEY",
      });
    } finally {
      if (previous) process.env.OPENAI_API_KEY = previous;
    }
  });

  it("rejects a response without parsed output", async () => {
    const { client } = mockClient(null);
    await expect(
      requestStructuredSyllabusExtraction(prompt, { client }),
    ).rejects.toMatchObject({ code: "NO_STRUCTURED_OUTPUT" });
  });

  it("maps provider failures without exposing provider details", async () => {
    const parse = vi.fn().mockRejectedValue(new Error("secret provider response"));
    const client = { responses: { parse } } as unknown as OpenAI;

    try {
      await requestStructuredSyllabusExtraction(prompt, { client });
      throw new Error("Expected provider failure");
    } catch (error) {
      expect(error).toBeInstanceOf(StructuredExtractionError);
      expect(error).toMatchObject({
        code: "PROVIDER_FAILURE",
        message: "The syllabus extraction service is temporarily unavailable.",
      });
      expect((error as Error).message).not.toContain("secret provider response");
    }
  });
});
