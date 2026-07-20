"use client";

import { DecisionCard, ZoneFrame, type DecisionCardViewModel } from "@/platform/components";
import { useProjectDecisions, type DecisionSummary } from "../contracts/decisions.contract";

function toViewModel(decision: DecisionSummary): DecisionCardViewModel {
  return {
    id: decision.id,
    problem: decision.summary,
    recommendation: null,
    impact: null,
    evidenceCount: decision.evidenceCount,
    evidenceHref: `/w/${decision.workspace_id}/p/${decision.project_id}/decisions/${decision.id}`,
    approvalStatus: decision.decision_status,
    recordedAt: decision.approved_at ?? decision.closed_at ?? undefined,
  };
}

/**
 * Decision Register list — Decisions zone
 * (03-screen-catalog.md §9, 08-command-center-experience.md §1's Pending
 * Decisions zone). Reused by both the Command Center's Pending Decisions
 * zone (filtered to pending_review) and the full Decision Register screen.
 */
export function DecisionList({
  projectId,
  statusFilter,
  title = "Decisions",
  emptyMessage = "No decisions recorded yet.",
  linkToDetail = true,
}: {
  projectId: string;
  statusFilter?: DecisionSummary["decision_status"][];
  title?: string;
  emptyMessage?: string;
  linkToDetail?: boolean;
}) {
  const { decisions, error, isLoading, mutate } = useProjectDecisions(projectId);
  const filtered = statusFilter ? decisions.filter((d) => statusFilter.includes(d.decision_status)) : decisions;

  return (
    <ZoneFrame title={title} isLoading={isLoading} error={error} isEmpty={filtered.length === 0} emptyMessage={emptyMessage} onRetry={() => mutate()}>
      <div className="flex flex-col gap-3">
        {filtered.map((decision) => {
          const card = <DecisionCard key={decision.id} decision={toViewModel(decision)} />;
          if (!linkToDetail) return card;
          return (
            <a key={decision.id} href={toViewModel(decision).evidenceHref} className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
              {card}
            </a>
          );
        })}
      </div>
    </ZoneFrame>
  );
}
