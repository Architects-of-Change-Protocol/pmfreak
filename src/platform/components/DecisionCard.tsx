import type { ReactNode } from "react";

export type DecisionCardViewModel = {
  id: string;
  problem: string;
  aiAnalysis?: { optionsConsidered: number } | null;
  recommendation?: string | null;
  impact?: string | null;
  evidenceCount: number;
  evidenceHref: string;
  approvalStatus: "draft" | "pending_review" | "approved" | "rejected" | "implemented" | "expired";
  pendingRoleLabel?: string | null;
  recordedBy?: string | null;
  recordedAt?: string | null;
};

const STATUS_LABEL: Record<DecisionCardViewModel["approvalStatus"], string> = {
  draft: "Draft",
  pending_review: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  implemented: "Implemented",
  expired: "Expired",
};

/**
 * A Decision as a composed 5-part record, never a table row
 * (08-ai-interaction-patterns.md §1). Once recorded it is never editable in
 * place — the only available action beyond viewing is a Feature-wired
 * `RevokeDecision`, passed in as `approvalActions` so this component never
 * dispatches a Command itself (07-frontend-module-boundaries.md §8).
 */
export function DecisionCard({ decision, approvalActions }: { decision: DecisionCardViewModel; approvalActions?: ReactNode }) {
  const isRecorded = decision.approvalStatus !== "draft" && decision.approvalStatus !== "pending_review";
  return (
    <article aria-label={`Decision ${decision.id}`} className="flex flex-col gap-3 rounded-lg border border-slate-500/30 p-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Problem</h3>
        <p className="text-sm text-slate-100">{decision.problem}</p>
      </div>

      {decision.aiAnalysis ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">AI Analysis</h3>
          <p className="text-sm text-slate-300">{decision.aiAnalysis.optionsConsidered} options considered</p>
        </div>
      ) : null}

      {decision.recommendation ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recommendation</h3>
          <p className="text-sm font-medium" style={{ color: "var(--pmf-ai-accent)" }}>
            {decision.recommendation}
          </p>
        </div>
      ) : null}

      {decision.impact ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Impact</h3>
          <p className="text-sm text-slate-100">{decision.impact}</p>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <a href={decision.evidenceHref} className="text-sm text-cyan-300 underline-offset-2 hover:underline focus-visible:underline">
          Evidence — {decision.evidenceCount} {decision.evidenceCount === 1 ? "source" : "sources"}
        </a>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Approval</h3>
        {isRecorded ? (
          <p className="text-sm text-slate-300">
            {STATUS_LABEL[decision.approvalStatus]}
            {decision.recordedBy ? ` by ${decision.recordedBy}` : ""}
            {decision.recordedAt ? ` on ${new Date(decision.recordedAt).toLocaleDateString()}` : ""}
          </p>
        ) : (
          <p className="text-sm text-slate-300">
            {STATUS_LABEL[decision.approvalStatus]}
            {decision.pendingRoleLabel ? ` · awaiting ${decision.pendingRoleLabel}` : ""}
          </p>
        )}
        {approvalActions}
      </div>
    </article>
  );
}
