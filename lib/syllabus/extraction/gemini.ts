import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { courseExtractionSchema, type CourseExtraction } from "../schema";
import type { SyllabusExtractionPrompt } from "./prompt";

export const DEFAULT_SYLLABUS_MODEL = "gemini-3.1-flash-lite";
export const DEFAULT_EXTRACTION_TIMEOUT_MS = 60_000;

export type StructuredExtractionErrorCode =
  | "MISSING_API_KEY"
  | "NO_STRUCTURED_OUTPUT"
  | "PROVIDER_FAILURE";

export class StructuredExtractionError extends Error {
  constructor(
    public readonly code: StructuredExtractionErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "StructuredExtractionError";
  }
}

type GeminiClient = Pick<GoogleGenAI, "models">;

export interface StructuredExtractionOptions {
  client?: GeminiClient;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

const unsupportedGeminiSchemaKeywords = new Set([
  "$schema",
  "default",
  "exclusiveMinimum",
  "minLength",
  "pattern",
]);

function toGeminiJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toGeminiJsonSchema);
  if (!value || typeof value !== "object") return value;

  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(input)) {
    if (unsupportedGeminiSchemaKeywords.has(key)) continue;
    if (key === "const") {
      output.enum = [child];
      continue;
    }
    output[key] = toGeminiJsonSchema(child);
  }

  return output;
}

export const SYLLABUS_RESPONSE_SCHEMA = toGeminiJsonSchema(
  z.toJSONSchema(courseExtractionSchema),
);

export async function requestStructuredSyllabusExtraction(
  prompt: SyllabusExtractionPrompt,
  options: StructuredExtractionOptions = {},
): Promise<CourseExtraction> {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  if (!options.client && !apiKey) {
    throw new StructuredExtractionError(
      "MISSING_API_KEY",
      "Syllabus extraction is not configured.",
    );
  }

  const client = options.client ?? new GoogleGenAI({ apiKey });

  try {
    const response = await client.models.generateContent({
      model:
        options.model ??
        process.env.GEMINI_SYLLABUS_MODEL ??
        DEFAULT_SYLLABUS_MODEL,
      contents: prompt.input,
      config: {
        systemInstruction: prompt.instructions,
        responseMimeType: "application/json",
        responseJsonSchema: SYLLABUS_RESPONSE_SCHEMA,
        temperature: 0,
        abortSignal: AbortSignal.timeout(
          options.timeoutMs ?? DEFAULT_EXTRACTION_TIMEOUT_MS,
        ),
      },
    });

    if (!response.text) {
      throw new StructuredExtractionError(
        "NO_STRUCTURED_OUTPUT",
        "The extraction model did not return syllabus data.",
      );
    }

    try {
      return JSON.parse(response.text) as CourseExtraction;
    } catch (error) {
      throw new StructuredExtractionError(
        "NO_STRUCTURED_OUTPUT",
        "The extraction model did not return valid syllabus data.",
        { cause: error },
      );
    }
  } catch (error) {
    if (error instanceof StructuredExtractionError) throw error;
    throw new StructuredExtractionError(
      "PROVIDER_FAILURE",
      "The syllabus extraction service is temporarily unavailable.",
      { cause: error },
    );
  }
}
