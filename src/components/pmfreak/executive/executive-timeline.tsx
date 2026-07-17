import type { ExecutiveTimelineEvent } from "@/lib/executive-timeline";

export function ExecutiveTimeline({ events }: { events: ExecutiveTimelineEvent[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500">Timeline</h2>
      <ul className="mt-3 space-y-2">
        {events.slice(-8).reverse().map((event) => (
          <li key={event.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
            <p className="font-medium text-slate-900">{new Date(event.timestamp).toLocaleDateString()} · {event.title}</p>
            <p>{event.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
