import type { PdfPageText } from "../pdf";
import type { Assessment, CourseExtraction, SourceEvidence } from "../schema";
import { normalizeTime } from "../normalize";

export const DEFAULT_MAX_EVIDENCE_LENGTH = 300;

function comparable(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

const monthNames = ["", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const fullMonthNames = ["", "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function dateMarkers(date: string): string[] {
  const [year, month, day] = date.split("-").map(Number);
  return [date, `${month}/${day}`, `${month}/${String(day).padStart(2, "0")}`, `${monthNames[month]} ${day}`, `${monthNames[month]}. ${day}`, `${monthNames[month]} ${day}, ${year}`, `${fullMonthNames[month]} ${day}`, `${fullMonthNames[month]} ${day}, ${year}`];
}

function timeMarkers(time: string): string[] {
  const [hour, minute] = time.split(":").map(Number);
  const hour12 = hour % 12 || 12; const meridiem = hour >= 12 ? "pm" : "am";
  return [time, `${hour12}:${String(minute).padStart(2, "0")} ${meridiem}`, ...(minute === 0 ? [`${hour12} ${meridiem}`] : [])];
}

function containsMarker(text: string, markers: string[]): boolean {
  const haystack = comparable(text).replace(/\*/g, "");
  return markers.some((marker) => haystack.includes(marker));
}

function titleMarkers(assessment: Assessment): string[] {
  return [assessment.title, assessment.id]
    .flatMap((value) => value.toLowerCase().match(/[a-z]+\d*|\d+/g) ?? [])
    .filter((value) => value.length >= 2 && !["exam", "assignment", "homework", "quiz"].includes(value));
}

function recoverEvidence(assessment: Assessment, pages: PdfPageText[], maxLength: number): SourceEvidence | null {
  const dates = [assessment.due_date, assessment.date, assessment.release_date].filter((value): value is string => value !== null);
  const markers = dates.flatMap(dateMarkers);
  const titles = titleMarkers(assessment);
  for (const page of pages) {
    for (const rawLine of page.text.split(/\r?\n/)) {
      const line = rawLine.replace(/\s+/g, " ").trim(); if (!line) continue;
      const titleMatch = titles.length === 0 || titles.some((marker) => comparable(line).includes(marker));
      const dateMatch = markers.length > 0 ? containsMarker(line, markers) : assessment.raw_date_text ? containsMarker(line, [assessment.raw_date_text]) : false;
      if (titleMatch && dateMatch) return { page: page.page, text: line.slice(0, maxLength) };
    }
  }
  return null;
}

function removeUnsupportedTimes(assessment: Assessment, source: SourceEvidence | null): Assessment {
  const evidence = source?.text ?? "";
  return {
    ...assessment,
    due_time: assessment.due_time && containsMarker(evidence, timeMarkers(assessment.due_time)) ? assessment.due_time : null,
    start_time: assessment.start_time && containsMarker(evidence, timeMarkers(assessment.start_time)) ? assessment.start_time : null,
    end_time: assessment.end_time && containsMarker(evidence, timeMarkers(assessment.end_time)) ? assessment.end_time : null,
  };
}

type DefaultableAssessmentType = "homework" | "quiz";

const policyCategoryPatterns: Record<DefaultableAssessmentType, RegExp> = {
  homework: /\b(?:homeworks?|hw|hws|assignments?|problem sets?)\b/i,
  quiz: /\bquizzes?\b/i,
};

function policyFragments(text: string): string[] {
  return text
    .split(/(?:\r?\n|(?<=[.!?])\s+)/)
    .map((fragment) => fragment.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function normalizePolicyTime(raw: string): string | null {
  return normalizeTime(raw.replace(/\./g, "").replace(/\s+/g, " ").trim()).value;
}

function findCategoryDueTimePolicies(
  pages: PdfPageText[],
): Record<DefaultableAssessmentType, Set<string>> {
  const policies: Record<DefaultableAssessmentType, Set<string>> = {
    homework: new Set<string>(),
    quiz: new Set<string>(),
  };
  const timeAfterDeadline = /\b(?:due|deadline|close[sd]?|submit(?:ted)?|submission)\b[^.!?\n]{0,100}?\b(?:at|by)\s+(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)|(?:[01]?\d|2[0-3]):[0-5]\d)\b/i;

  for (const page of pages) {
    for (const fragment of policyFragments(page.text)) {
      const timeMatch = fragment.match(timeAfterDeadline);
      if (!timeMatch) continue;
      const time = normalizePolicyTime(timeMatch[1]);
      if (!time) continue;

      for (const type of Object.keys(policyCategoryPatterns) as DefaultableAssessmentType[]) {
        if (policyCategoryPatterns[type].test(fragment)) policies[type].add(time);
      }
    }
  }

  return policies;
}

function applyDueTimePolicy(
  assessment: Assessment,
  policies: Record<DefaultableAssessmentType, Set<string>>,
): Assessment {
  if (
    assessment.date_status !== "confirmed" ||
    !assessment.due_date ||
    assessment.due_time ||
    (assessment.type !== "homework" && assessment.type !== "quiz")
  ) {
    return assessment;
  }

  const policyTimes = [...policies[assessment.type]];
  return { ...assessment, due_time: policyTimes.length === 1 ? policyTimes[0] : "23:59" };
}

function verifyEvidence(
  source: SourceEvidence | null,
  pages: PdfPageText[],
  maxLength: number,
): SourceEvidence | null {
  if (!source || (!source.page && !source.text)) return null;

  const text = source.text?.trim().slice(0, maxLength) ?? null;
  if (!text) {
    return source.page && pages.some((page) => page.page === source.page)
      ? { page: source.page, text: null }
      : null;
  }

  const needle = comparable(text);
  const matchingPages = pages.filter((page) => comparable(page.text).includes(needle));

  if (source.page) {
    const claimedPage = pages.find((page) => page.page === source.page);
    if (!claimedPage || !comparable(claimedPage.text).includes(needle)) return null;
    return { page: source.page, text };
  }

  return matchingPages.length > 0
    ? { page: matchingPages[0].page, text }
    : null;
}

export function verifyAssessmentEvidence(
  extraction: CourseExtraction,
  pages: PdfPageText[],
  maxLength = DEFAULT_MAX_EVIDENCE_LENGTH,
): CourseExtraction {
  const evidenceWarnings = [...extraction.metadata.warnings];
  const dueTimePolicies = findCategoryDueTimePolicies(pages);
  const assessments = extraction.assessments.map((assessment) => {
    const supplied = verifyEvidence(assessment.source, pages, maxLength);
    const source = supplied?.text ? supplied : recoverEvidence(assessment, pages, maxLength) ?? supplied;

    if (!source) {
      evidenceWarnings.push({
        type: "source_mismatch",
        message: assessment.source
          ? `Source evidence for ${assessment.title} could not be verified.`
          : `No source evidence was provided for ${assessment.title}.`,
        assessment_id: assessment.id,
        source: null,
      });
    }

    return applyDueTimePolicy(
      removeUnsupportedTimes({ ...assessment, source }, source),
      dueTimePolicies,
    );
  });

  return {
    ...extraction,
    assessments,
    metadata: {
      ...extraction.metadata,
      warnings: evidenceWarnings,
    },
  };
}
