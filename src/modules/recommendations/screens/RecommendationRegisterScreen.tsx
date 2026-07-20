import { can, CAPABILITY_DENIAL_COPY } from "@/platform/permissions";
import { RecommendationList } from "../features/RecommendationList";

/** Recommendations screen (03-screen-catalog.md §9) — Pending view for this slice. */
export async function RecommendationRegisterScreen({ projectId }: { projectId: string }) {
  const approval = await can("APPROVE_DECISION", { projectId });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Recommendations</h1>
        <p className="text-sm text-slate-400">AI-generated recommendations awaiting review for this project.</p>
      </header>
      <div className="flex flex-col gap-4">
        <RecommendationList
          projectId={projectId}
          status="proposed"
          canApprove={approval.allowed}
          approvalDeniedReason={approval.allowed ? undefined : CAPABILITY_DENIAL_COPY.APPROVE_DECISION}
        />
      </div>
    </div>
  );
}
