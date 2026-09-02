"use client";

import { useEffect, useState } from "react";

interface CalendarChoice {
  id: string;
  name: string;
  timeZone: string;
  primary: boolean;
}

type LoadState =
  | { phase: "loading" }
  | { phase: "disconnected" }
  | { phase: "ready"; calendars: CalendarChoice[]; selectedId: string }
  | { phase: "error"; message: string };

export function GoogleCalendarSettings() {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/calendar/google/calendars")
      .then(async (response) => {
        if (response.status === 502) return null;
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ calendars: CalendarChoice[]; selected_calendar_id: string | null }>;
      })
      .then((result) => {
        if (!active) return;
        if (!result) setState({ phase: "disconnected" });
        else setState({ phase: "ready", calendars: result.calendars, selectedId: result.selected_calendar_id ?? "" });
      })
      .catch(() => active && setState({ phase: "error", message: "Calendar settings could not be loaded." }));
    return () => { active = false; };
  }, []);

  async function selectCalendar(calendarId: string) {
    if (state.phase !== "ready") return;
    setSaving(true);
    try {
      const response = await fetch("/api/calendar/google/calendars", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendar_id: calendarId }),
      });
      if (!response.ok) throw new Error();
      setState({ ...state, selectedId: calendarId });
    } catch {
      setState({ phase: "error", message: "The calendar selection could not be saved." });
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setSaving(true);
    try {
      const response = await fetch("/api/calendar/google/connection", { method: "DELETE" });
      if (!response.ok) throw new Error();
      setState({ phase: "disconnected" });
    } catch {
      setState({ phase: "error", message: "Google Calendar could not be disconnected." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="google-calendar-title" className="mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 id="google-calendar-title" className="text-xl font-semibold">Google Calendar</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">Choose where confirmed course events will be added.</p>

      {state.phase === "loading" && <p className="mt-4 text-sm text-zinc-500">Loading calendar connection…</p>}
      {state.phase === "disconnected" && (
        <a href="/api/calendar/google/connect" className="mt-4 inline-flex rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          Connect Google Calendar
        </a>
      )}
      {state.phase === "error" && <p role="alert" className="mt-4 text-sm text-red-700">{state.message}</p>}
      {state.phase === "ready" && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-medium text-zinc-800">
            Destination calendar
            <select
              className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-950"
              value={state.selectedId}
              disabled={saving}
              onChange={(event) => void selectCalendar(event.target.value)}
            >
              <option value="" disabled>Select a calendar</option>
              {state.calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>{calendar.name}{calendar.primary ? " (primary)" : ""}</option>
              ))}
            </select>
          </label>
          <button type="button" disabled={saving} onClick={() => void disconnect()} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50">
            Disconnect
          </button>
        </div>
      )}
    </section>
  );
}
