import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { courseExtractionSchema, type CourseExtraction } from "../schema";
import type { SyllabusExtractionPrompt } from "./prompt";

export const DEFAULT_SYLLABUS_MODEL = "gpt-5.4-mini";
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

export interface StructuredExtractionOptions {
  client?: OpenAI;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export async function requestStructuredSyllabusExtraction(
  prompt: SyllabusExtractionPrompt,
  options: StructuredExtractionOptions = {},
): Promise<CourseExtraction> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!options.client && !apiKey) {
    throw new StructuredExtractionError(
      "MISSING_API_KEY",
      "Syllabus extraction is not configured.",
    );
  }

  const client =
    options.client ??
    new OpenAI({
      apiKey,
      timeout: options.timeoutMs ?? DEFAULT_EXTRACTION_TIMEOUT_MS,
      maxRetries: 1,
    });

  try {
    const response = await client.responses.parse({
      model: options.model ?? process.env.OPENAI_SYLLABUS_MODEL ?? DEFAULT_SYLLABUS_MODEL,
      store: false,
      input: [
        { role: "system", content: prompt.instructions },
        { role: "user", content: prompt.input },
      ],
      text: {
        format: zodTextFormat(courseExtractionSchema, "syllabus_extraction"),
      },
    });

    if (!response.output_parsed) {
      throw new StructuredExtractionError(
        "NO_STRUCTURED_OUTPUT",
        "The extraction model did not return syllabus data.",
      );
    }

    return response.output_parsed;
  } catch (error) {
    if (error instanceof StructuredExtractionError) throw error;
    throw new StructuredExtractionError(
      "PROVIDER_FAILURE",
      "The syllabus extraction service is temporarily unavailable.",
      { cause: error },
    );
  }
}
