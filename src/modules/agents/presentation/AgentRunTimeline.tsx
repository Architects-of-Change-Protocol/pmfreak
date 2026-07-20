import type { AgentExecutionRequestRecord } from "../contracts/agents.contract";

const APPROVAL_TERMINAL_STATES = new Set(["approved", "ready_for_execution", "executing", "completed"]);

/**
 * An individual Agent Run as an auditable execution trace, not a chat log
 * (08-ai-interaction-patterns.md §4). Output is always stated as a count,
 * never phrased as though the Agent already decided or acted; "Human
 * approval: Required" carries the same visual prominence an
 * ApprovalFlow control requires.
 */
export function AgentRunTimeline({ run }: { run: AgentExecutionRequestRecord }) {
  const outputCount = run.resultPayload && typeof run.resultPayload === "object" ? Object.keys(run.resultPayload).length : 0;

  return (
    <article aria-label={`Agent Run ${run.id}`} className="flex flex-col gap-4 rounded-lg border border-slate-500/30 p-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Input</h3>
        <p className="text-sm text-slate-100">{run.title}</p>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</h3>
        <ol className="mt-1 list-inside list-decimal text-sm text-slate-300">
          <li>Invoke {run.toolKey}</li>
        </ol>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Output</h3>
        <p className="text-sm text-slate-100">
          {run.executionState === "completed"
            ? `${outputCount || 1} result(s) produced`
            : run.executionState === "failed"
              ? "Failed"
              : "Pending"}
        </p>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Human Approval</h3>
        <p className="text-sm text-slate-100">
          {!run.requiresApproval
            ? "Not required"
            : APPROVAL_TERMINAL_STATES.has(run.executionState)
              ? `Approved${run.approvedBy ? ` by ${run.approvedBy}` : ""}`
              : "Required"}
        </p>
      </div>
    </article>
  );
}
