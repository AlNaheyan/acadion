import type { Assessment } from "../../lib/syllabus";

export type AssessmentTab = "exams" | "homework" | "quizzes" | "others";

export const assessmentTabs: Array<{ id: AssessmentTab; label: string }> = [
  { id: "exams", label: "Exams" },
  { id: "homework", label: "Homework" },
  { id: "quizzes", label: "Quizzes" },
  { id: "others", label: "Others" },
];

export function assessmentTabFor(type: Assessment["type"]): AssessmentTab {
  if (type === "midterm" || type === "exam" || type === "final_exam") return "exams";
  if (type === "homework") return "homework";
  if (type === "quiz") return "quizzes";
  return "others";
}

export function assessmentsForTab(assessments: Assessment[], tab: AssessmentTab): Assessment[] {
  return assessments.filter((assessment) => assessmentTabFor(assessment.type) === tab);
}
