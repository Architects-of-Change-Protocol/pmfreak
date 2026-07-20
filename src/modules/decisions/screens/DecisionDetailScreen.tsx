import { can, CAPABILITY_DENIAL_COPY } from "@/platform/permissions";
import { DecisionDetail } from "../features/DecisionDetail";

/** Decision detail (Decision detail drawer per 03-screen-catalog.md §9), promoted to its own route for this slice. */
export async function DecisionDetailScreen({ projectId, decisionId, evidenceHref }: { projectId: string; decisionId: string; evidenceHref: string }) {
  const approval = await can("APPROVE_DECISION", { projectId });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Decision {decisionId}</h1>
      </header>
      <DecisionDetail
        decisionId={decisionId}
        canApprove={approval.allowed}
        approvalDeniedReason={approval.allowed ? undefined : CAPABILITY_DENIAL_COPY.APPROVE_DECISION}
        evidenceHref={evidenceHref}
      />
    </div>
  );
}
