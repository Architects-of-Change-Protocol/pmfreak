"use client";

import { ApprovalFlow, DecisionCard, EvidenceViewer, ZoneFrame, type DecisionCardViewModel } from "@/platform/components";
import { approveDecision, rejectDecision, useDecision } from "../contracts/decisions.contract";

const DECISION_TYPE_ROLE_LABEL: Record<string, string> = {
  risk_response: "PM approval",
  scope_change: "sponsor approval",
  schedule_change: "PM approval",
  budget_change: "finance approval",
  resource_change: "PM approval",
  stakeholder_action: "stakeholder approval",
  governance_exception: "governance approval",
  vendor_action: "PM approval",
  dependency_resolution: "PM approval",
  other: "approval",
};

/**
 * Decision detail — the full 5-part composed record plus its Evidence Panel
 * and governed ApprovalFlow (08-ai-interaction-patterns.md §1, §5, §6).
 * `canApprove` is resolved server-side by the Screen and passed down —
 * this Feature never branches on a role string itself.
 */
export function DecisionDetail({ decisionId, canApprove, approvalDeniedReason, evidenceHref }: { decisionId: string; canApprove: boolean; approvalDeniedReason?: string; evidenceHref: string }) {
  const { decision, lineage, error, isLoading, mutate } = useDecision(decisionId);

  return (
    <ZoneFrame title="Decision" isLoading={isLoading} error={error} isEmpty={!decision} emptyMessage="Decision not found." onRetry={() => mutate()}>
      {decision && lineage ? (
        <div className="flex flex-col gap-6">
          <DecisionCard
            decision={
              {
                id: decision.id,
                problem: decision.summary,
                aiAnalysis: decision.recommendation_id ? { optionsConsidered: 1 } : null,
                recommendation: decision.decision_rationale,
                impact: null,
                evidenceCount: lineage.evidence.length,
                evidenceHref: "#evidence",
                approvalStatus: decision.decision_status,
                pendingRoleLabel: DECISION_TYPE_ROLE_LABEL[decision.decision_type],
                recordedBy: decision.approved_by ?? decision.rejected_by ?? undefined,
                recordedAt: decision.approved_at ?? decision.rejected_at ?? undefined,
              } satisfies DecisionCardViewModel
            }
            approvalActions={
              decision.decision_status === "pending_review" ? (
                <ApprovalFlow
                  itemLabel={decision.title}
                  disabled={!canApprove}
                  disabledReason={approvalDeniedReason}
                  onApprove={async () => {
                    const result = await approveDecision(decision.id);
                    if (!result.ok) throw new Error(result.error);
                    await mutate();
                  }}
                  onReject={async () => {
                    const result = await rejectDecision(decision.id);
                    if (!result.ok) throw new Error(result.error);
                    await mutate();
                  }}
                />
              ) : null
            }
          />

          <div id="evidence">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Evidence</h2>
            <EvidenceViewer
              sourceDocuments={lineage.evidence.map((link) => ({ id: link.id, name: `${link.evidence_type} (${link.relationship_type})`, href: evidenceHref }))}
              historicalData={null}
              metrics={[]}
              agentReasoning={decision.recommendation_id ? { summary: "Informed by an approved Recommendation.", runHref: evidenceHref } : null}
              confidence={{ value: decision.recommendation_id ? 80 : 50, basis: decision.recommendation_id ? "Based on the linked Recommendation's analysis" : "No AI recommendation informed this decision" }}
            />
          </div>
        </div>
      ) : null}
    </ZoneFrame>
  );
}
