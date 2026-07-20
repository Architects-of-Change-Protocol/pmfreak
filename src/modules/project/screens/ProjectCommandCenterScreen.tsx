import { can, CAPABILITY_DENIAL_COPY } from "@/platform/permissions";
import { AttentionPanel } from "../features/AttentionPanel";
import { RecommendationPanel } from "../features/RecommendationPanel";
import { DecisionPanel } from "../features/DecisionPanel";
import { ExecutionHealthCard } from "../features/ExecutionHealthCard";

/**
 * Project Command Center (03-screen-catalog.md §8) — the fixed four-zone
 * composition ADR-PMF-070 mandates, in the same order for every entity
 * level: Attention Required, AI Recommendations, Pending Decisions,
 * Execution Health. Project-scoped only — never mixes in cross-PMO
 * Workspace-level data (08-command-center-experience.md's Note).
 */
export async function ProjectCommandCenterScreen({ projectId }: { projectId: string }) {
  const approval = await can("APPROVE_DECISION", { projectId });

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Command Center — Project</h1>
      </header>
      <AttentionPanel projectId={projectId} />
      <RecommendationPanel projectId={projectId} canApprove={approval.allowed} approvalDeniedReason={approval.allowed ? undefined : CAPABILITY_DENIAL_COPY.APPROVE_DECISION} />
      <DecisionPanel projectId={projectId} />
      <ExecutionHealthCard projectId={projectId} />
    </div>
  );
}
