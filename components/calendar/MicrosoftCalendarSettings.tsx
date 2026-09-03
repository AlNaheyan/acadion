"use client";

import { useEffect, useState } from "react";

interface Calendar { id: string; name: string; isDefault: boolean }
export function MicrosoftCalendarSettings({ embedded = false }: { embedded?: boolean }) {
  const [calendars, setCalendars] = useState<Calendar[] | null>(null);
  const [selected, setSelected] = useState("");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { void fetch("/api/calendar/microsoft/calendars").then(async (response) => {
    if (!response.ok) { setConnected(false); return; }
    const body = await response.json() as { calendars: Calendar[]; selected_calendar_id: string | null };
    setCalendars(body.calendars); setSelected(body.selected_calendar_id ?? ""); setConnected(true);
  }).catch(() => setMessage("Outlook settings could not be loaded.")); }, []);
  async function choose(id: string) {
    setMessage(""); const response = await fetch("/api/calendar/microsoft/calendars", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ calendar_id: id }) });
    if (response.ok) setSelected(id); else setMessage("The Outlook calendar selection could not be saved.");
  }
  async function disconnect() {
    const response = await fetch("/api/calendar/microsoft/connection", { method: "DELETE" });
    if (response.ok) { setConnected(false); setCalendars(null); } else setMessage("Outlook could not be disconnected.");
  }
  return <section aria-labelledby="outlook-title" className={embedded ? "rounded-2xl border border-zinc-200 bg-zinc-50 p-4" : "mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"}>
    <h3 id="outlook-title" className="font-semibold">Microsoft Outlook</h3>
    <p className="mt-2 text-sm text-zinc-600">Choose an editable Outlook calendar for confirmed course events.</p>
    {connected === null && !message && <p className="mt-4 text-sm text-zinc-500">Loading Outlook connection…</p>}
    {connected === false && <a href="/api/calendar/microsoft/connect" className="mt-4 inline-flex rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white">Connect Microsoft Outlook</a>}
    {connected && calendars && <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex-1 text-sm font-medium">Destination calendar
        <select value={selected} onChange={(event) => void choose(event.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2">
          <option value="" disabled>Select a calendar</option>
          {calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}{calendar.isDefault ? " (default)" : ""}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => void disconnect()} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium">Disconnect</button>
    </div>}
    {message && <p role="alert" className="mt-4 text-sm text-red-700">{message}</p>}
  </section>;
}
