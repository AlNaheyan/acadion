import type { Assessment } from "../../lib/syllabus";

export interface AssessmentCounts {
  homework: number;
  quizzes: number;
  midterms: number;
  examsAndFinals: number;
  otherDated: number;
}

function hasDate(assessment: Assessment): boolean {
  return Boolean(
    assessment.release_date || assessment.due_date || assessment.date,
  );
}

export function countAssessments(
  assessments: Assessment[],
): AssessmentCounts {
  return assessments.reduce<AssessmentCounts>(
    (counts, assessment) => {
      switch (assessment.type) {
        case "homework":
          counts.homework += 1;
          break;
        case "quiz":
          counts.quizzes += 1;
          break;
        case "midterm":
          counts.midterms += 1;
          break;
        case "exam":
        case "final_exam":
          counts.examsAndFinals += 1;
          break;
        default:
          if (hasDate(assessment)) counts.otherDated += 1;
      }
      return counts;
    },
    {
      homework: 0,
      quizzes: 0,
      midterms: 0,
      examsAndFinals: 0,
      otherDated: 0,
    },
  );
}
