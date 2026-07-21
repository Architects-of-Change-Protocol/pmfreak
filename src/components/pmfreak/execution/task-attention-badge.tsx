import type { TaskAttentionReason } from "@/lib/execution-attention";

const REASON_LABEL: Record<TaskAttentionReason, string> = {
  overdue: "Overdue",
  due_today: "Due today",
  blocked: "Blocked",
  high_priority: "High priority",
  unassigned: "Unassigned",
};

const REASON_STYLE: Record<TaskAttentionReason, string> = {
  overdue: "border-rose-300 bg-rose-50 text-rose-800",
  due_today: "border-amber-300 bg-amber-50 text-amber-800",
  blocked: "border-orange-300 bg-orange-50 text-orange-800",
  high_priority: "border-purple-300 bg-purple-50 text-purple-800",
  unassigned: "border-slate-300 bg-slate-50 text-slate-700",
};

/**
 * Every badge names the specific reason (never a bare "Needs attention") —
 * see daily-execution-workspace.md's Attention Matrix. Reasons are shown in
 * their evaluation-priority order (overdue/blocked first), not insertion
 * order, so the most actionable label reads first even when several apply.
 */
const REASON_DISPLAY_ORDER: TaskAttentionReason[] = ["overdue", "blocked", "due_today", "high_priority", "unassigned"];

export function TaskAttentionBadges({ reasons }: { reasons: TaskAttentionReason[] }) {
  if (reasons.length === 0) return null;
  const ordered = REASON_DISPLAY_ORDER.filter((reason) => reasons.includes(reason));
  return (
    <span className="flex flex-wrap gap-1">
      {ordered.map((reason) => (
        <span
          key={reason}
          data-testid={`attention-badge-${reason}`}
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${REASON_STYLE[reason]}`}
        >
          {REASON_LABEL[reason]}
        </span>
      ))}
    </span>
  );
}
