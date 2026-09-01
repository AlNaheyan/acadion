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
