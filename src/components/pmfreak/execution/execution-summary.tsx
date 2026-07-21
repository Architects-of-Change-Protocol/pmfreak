"use client";

import type { ExecutionAttentionSummary } from "@/lib/execution-attention";
import type { ExecutionAttentionFilter } from "@/lib/execution-attention";

/**
 * Real counts only — every number is summarizeExecutionAttention's actual
 * array length, never a percentage or "health" figure. Each chip doubles
 * as the matching attention filter, so "3 overdue" and clicking it always
 * agree on which 3 tasks.
 */
export function ExecutionSummary({
  summary,
  activeFilter,
  onFilterChange,
}: {
  summary: ExecutionAttentionSummary;
  activeFilter: ExecutionAttentionFilter | null;
  onFilterChange: (filter: ExecutionAttentionFilter | null) => void;
}) {
  const chips: Array<{ key: ExecutionAttentionFilter; label: string; count: number }> = [
    { key: "needs_attention", label: "need attention", count: summary.needsAttention },
    { key: "overdue", label: "overdue", count: summary.overdue },
    { key: "due_today", label: "due today", count: summary.dueToday },
    { key: "blocked", label: "blocked", count: summary.blocked },
    { key: "unassigned", label: "unassigned", count: summary.unassigned },
  ];

  return (
    <div className="flex flex-wrap gap-2" data-testid="execution-summary">
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
        {summary.inProgress} in progress
      </span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onFilterChange(activeFilter === chip.key ? null : chip.key)}
          disabled={chip.count === 0}
          data-testid={`execution-summary-chip-${chip.key}`}
          aria-pressed={activeFilter === chip.key}
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition disabled:cursor-default disabled:opacity-40 ${
            activeFilter === chip.key ? "border-cyan-500 bg-cyan-50 text-cyan-900" : "border-slate-200 bg-white text-slate-700 hover:border-cyan-300"
          }`}
        >
          {chip.count} {chip.label}
        </button>
      ))}
    </div>
  );
}
