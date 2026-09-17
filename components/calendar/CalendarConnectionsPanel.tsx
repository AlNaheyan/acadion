import { Link2 } from "lucide-react";

import { GoogleCalendarSettings } from "./GoogleCalendarSettings";

export function CalendarConnectionsPanel() {
  return (
    <aside aria-labelledby="calendar-connections-title" className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-100">
          <Link2 aria-hidden="true" className="h-4 w-4 text-zinc-700" />
        </span>
        <div>
          <h2 id="calendar-connections-title" className="font-semibold text-zinc-950">Calendar connections</h2>
          <p className="text-xs text-zinc-500">Choose where events should go.</p>
        </div>
      </div>
      <GoogleCalendarSettings embedded />
    </aside>
  );
}
