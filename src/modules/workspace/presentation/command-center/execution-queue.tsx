import type { GovernedExecutionChain } from "./execution-read-model";
import { StatusBadge } from "./status-badge";
import { SectionEmptyState, SectionLoadingState } from "./section-empty-state";

/** Short, honest one-liner for where a chain currently stands. */
function describe(chain: GovernedExecutionChain): string {
  if (!chain.action) {
    return chain.decisionStatus === "rejected"
      ? "Decision recorded — rejected, so no action follows"
      : "Decision recorded — no action requested yet";
  }
  if (!chain.task) return "Action authorized — no task yet";
  if (!chain.outcome) return chain.boundary.executionCompleted ? "Work completed — no expected outcome yet" : "Task created — work in progress";
  if (chain.observations.length === 0) return "Outcome expected — no observation yet";
  return `Observed: ${chain.observations[0].observationState.replaceAll("_", " ")}`;
}

export function ExecutionQueue({
  chains,
  onSelect,
  loading = false,
}: {
  chains: GovernedExecutionChain[];
  onSelect: (chain: GovernedExecutionChain) => void;
  loading?: boolean;
}) {
  const showEmpty = !loading && chains.length === 0;
  return (
    <section aria-labelledby="execution-chain-heading">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 id="execution-chain-heading" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          After Your Decision
        </h2>
      </div>

      <div role="status" aria-live="polite">
        {loading && chains.length === 0 && <SectionLoadingState label="Checking what you have decided…" />}
      </div>

      {showEmpty && (
        <SectionEmptyState
          title="Nothing has been decided yet."
          description="Once you record a decision, the governed action, task, execution and outcome appear here."
        />
      )}

      <ul className="mt-2 space-y-1.5">
        {chains.map((chain) => (
          <li key={chain.id}>
            <button
              type="button"
              onClick={() => onSelect(chain)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-white/20 hover:bg-white/[0.05] focus:border-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-zinc-200">{chain.title}</span>
                <span className="block truncate text-[11px] text-zinc-500">{describe(chain)}</span>
              </span>
              <StatusBadge tone={chain.boundary.outcomeAchieved ? "success" : "task"}>
                {chain.boundary.outcomeAchieved ? "Outcome achieved" : "In progress"}
              </StatusBadge>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
