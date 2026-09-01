import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

async function migration(name: string): Promise<string> {
  return readFile(path.join(process.cwd(), "supabase", "migrations", name), "utf8");
}

describe("imported courses migration", () => {
  it("keeps imported courses separate, indexed, constrained, and owner-readable", async () => {
    const sql = await migration("202609010001_create_imported_courses.sql");

    expect(sql).toContain("create table if not exists public.imported_courses");
    expect(sql).not.toMatch(/create table if not exists public\.courses\b/);
    expect(sql).toContain("imported_courses_user_id_idx");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("auth.jwt() ->> 'sub'");
    expect(sql).toContain("extraction_warnings jsonb");
  });
});

describe("course meetings migration", () => {
  it("adds cascading, constrained, owner-readable meeting rows", async () => {
    const sql = await migration("202609010002_create_course_meetings.sql");

    expect(sql).toContain("create table if not exists public.course_meetings");
    expect(sql).toContain("references public.imported_courses(id) on delete cascade");
    expect(sql).toContain("course_meetings_time_range");
    expect(sql).toContain("course_meetings_date_range");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("imported_courses.user_id = (select auth.jwt() ->> 'sub')");
  });
});

describe("course assessments migration", () => {
  it("constrains assessment dates, types, evidence, ownership, and rules", async () => {
    const sql = await migration("202609010003_create_course_assessments.sql");

    expect(sql).toContain("create table if not exists public.course_assessments");
    expect(sql).toContain("unique (course_id, external_id)");
    expect(sql).toContain("course_assessments_status_dates");
    expect(sql).toContain("char_length(source_text) <= 300");
    expect(sql).toContain("create table if not exists public.assessment_rules");
    expect(sql.match(/enable row level security/g)).toHaveLength(2);
    expect(sql).toContain("on delete cascade");
  });
});

describe("syllabus uploads migration", () => {
  it("tracks bounded safe metadata and lifecycle without raw text", async () => {
    const sql = await migration("202609010004_create_syllabus_uploads.sql");

    expect(sql).toContain("create table if not exists public.syllabus_uploads");
    expect(sql).toContain("file_size > 0 and file_size <= 10485760");
    expect(sql).toContain("pending', 'extracting', 'success', 'failed");
    expect(sql).toContain("syllabus_uploads_success_course");
    expect(sql).toContain("enable row level security");
    expect(sql).not.toContain("raw_extracted_text");
  });
});
