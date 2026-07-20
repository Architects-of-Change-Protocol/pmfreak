/**
 * Renders an Agent Definition's status/capabilities/last-run summary
 * (08-ai-interaction-patterns.md §4). Status reflects Configuration state
 * only, never an individual run's state; capabilities are read from the
 * Agent Definition, never inferred from observed behavior; "Last run"
 * links to that run's own view rather than inlining full detail
 * (progressive disclosure, 08-ux-principles.md §2 Principle 5).
 */
export function AgentStatus({
  name,
  status,
  capabilities,
  lastRun,
}: {
  name: string;
  status: "active" | "disabled";
  capabilities: string[];
  lastRun?: { relativeTime: string; href: string } | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-slate-100">{name}</span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
          style={
            status === "active"
              ? { color: "var(--pmf-severity-ok)", borderColor: "var(--pmf-severity-ok)", backgroundColor: "var(--pmf-severity-ok-bg)" }
              : { color: "var(--pmf-severity-neutral)", borderColor: "var(--pmf-severity-neutral)", backgroundColor: "var(--pmf-severity-neutral-bg)" }
          }
        >
          <span aria-hidden="true">{status === "active" ? "✓" : "–"}</span>
          {status === "active" ? "Active" : "Disabled"}
        </span>
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Capabilities">
        {capabilities.map((capability) => (
          <li key={capability} className="rounded-full border border-slate-400/30 px-2 py-0.5 text-xs text-slate-300">
            {capability}
          </li>
        ))}
      </ul>
      {lastRun ? (
        <a href={lastRun.href} className="text-xs text-cyan-300 underline-offset-2 hover:underline focus-visible:underline">
          Last run: {lastRun.relativeTime} — view Agent Run
        </a>
      ) : (
        <span className="text-xs text-slate-500">No runs yet</span>
      )}
    </div>
  );
}
