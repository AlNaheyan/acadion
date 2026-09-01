import type { GoogleGenAI } from "@google/genai";
import { describe, expect, it, vi } from "vitest";

import type { CourseExtraction } from "../schema";
import {
  DEFAULT_SYLLABUS_MODEL,
  requestStructuredSyllabusExtraction,
  StructuredExtractionError,
  SYLLABUS_RESPONSE_SCHEMA,
} from "./gemini";

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

type GeminiClient = Pick<GoogleGenAI, "models">;

function mockClient(output: CourseExtraction | null): {
  client: GeminiClient;
  generateContent: ReturnType<typeof vi.fn>;
} {
  const generateContent = vi.fn().mockResolvedValue({
    text: output ? JSON.stringify(output) : undefined,
  });
  return {
    client: { models: { generateContent } } as unknown as GeminiClient,
    generateContent,
  };
}

describe("requestStructuredSyllabusExtraction", () => {
  it("uses Gemini structured output with the canonical schema", async () => {
    const { client, generateContent } = mockClient(extraction);

    await expect(
      requestStructuredSyllabusExtraction(prompt, { client }),
    ).resolves.toEqual(extraction);

    expect(generateContent).toHaveBeenCalledOnce();
    expect(generateContent.mock.calls[0][0]).toMatchObject({
      model: DEFAULT_SYLLABUS_MODEL,
      contents: prompt.input,
      config: {
        systemInstruction: prompt.instructions,
        responseMimeType: "application/json",
        responseJsonSchema: SYLLABUS_RESPONSE_SCHEMA,
        temperature: 0,
      },
    });
  });

  it("removes unsupported keywords from the Gemini response schema", () => {
    const serializedSchema = JSON.stringify(SYLLABUS_RESPONSE_SCHEMA);
    expect(serializedSchema).not.toContain('"$schema"');
    expect(serializedSchema).not.toContain('"default"');
    expect(serializedSchema).not.toContain('"const"');
    expect(serializedSchema).not.toContain('"pattern"');
    expect(serializedSchema).toContain('"enum":["syllabus"]');
  });

  it("supports an explicit model override", async () => {
    const { client, generateContent } = mockClient(extraction);
    await requestStructuredSyllabusExtraction(prompt, {
      client,
      model: "test-model",
    });
    expect(generateContent.mock.calls[0][0].model).toBe("test-model");
  });

  it("fails clearly when no API key or client is configured", async () => {
    const previous = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      await expect(requestStructuredSyllabusExtraction(prompt)).rejects.toMatchObject({
        code: "MISSING_API_KEY",
      });
    } finally {
      if (previous) process.env.GEMINI_API_KEY = previous;
    }
  });

  it("rejects a response without structured output", async () => {
    const { client } = mockClient(null);
    await expect(
      requestStructuredSyllabusExtraction(prompt, { client }),
    ).rejects.toMatchObject({ code: "NO_STRUCTURED_OUTPUT" });
  });

  it("rejects malformed JSON output", async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: "not json" });
    const client = { models: { generateContent } } as unknown as GeminiClient;
    await expect(
      requestStructuredSyllabusExtraction(prompt, { client }),
    ).rejects.toMatchObject({ code: "NO_STRUCTURED_OUTPUT" });
  });

  it("maps provider failures without exposing provider details", async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValue(new Error("secret provider response"));
    const client = { models: { generateContent } } as unknown as GeminiClient;

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
