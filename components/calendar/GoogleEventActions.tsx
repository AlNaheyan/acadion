"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import type { ImportedSyllabusResponse } from "../syllabus/upload-state";

type EventKind = "classes" | "assessments";
export function GoogleEventActions({ result }: { result: ImportedSyllabusResponse }) {
  const [working, setWorking] = useState<EventKind | null>(null);
  const [message, setMessage] = useState("");
  async function create(kind: EventKind) {
    setWorking(kind); setMessage("");
    try {
      const response = await fetch(`/api/courses/${encodeURIComponent(result.course_id)}/calendar/google/${kind}`, { method: "POST" });
      const body = await response.json() as { created_count?: number; failed_count?: number; error?: { message?: string } };
      if (!response.ok && response.status !== 207) throw new Error(body.error?.message);
      setMessage(`${body.created_count ?? 0} event${body.created_count === 1 ? "" : "s"} added to Google Calendar${body.failed_count ? `; ${body.failed_count} can be retried` : ""}.`);
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "Google Calendar events could not be created.");
    } finally { setWorking(null); }
  }
  return <div className="rounded-2xl border border-zinc-200 p-4">
    <h3 className="font-semibold text-zinc-950">Google Calendar</h3>
    <p className="mt-1 text-sm text-zinc-500">Add directly to your selected calendar.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={working !== null} onClick={() => void create("classes")}>{working === "classes" ? "Adding…" : "Add classes"}</Button>
      <Button type="button" variant="outline" disabled={working !== null} onClick={() => void create("assessments")}>{working === "assessments" ? "Adding…" : "Add assessments"}</Button>
    </div>
    {message && <p aria-live="polite" className="mt-3 text-sm text-zinc-700">{message}</p>}
  </div>;
}
