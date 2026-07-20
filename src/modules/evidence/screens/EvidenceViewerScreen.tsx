import { can, CAPABILITY_DENIAL_COPY } from "@/platform/permissions";
import { EvidenceList } from "../features/EvidenceList";

/** Documents / Evidence Viewer foundation (03-canonical-information-architecture.md §5.8). */
export async function EvidenceViewerScreen({ projectId }: { projectId: string }) {
  const access = await can("VIEW_EVIDENCE", { projectId });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Evidence</h1>
        <p className="text-sm text-slate-400">Every source document and metric a Recommendation or Decision can cite for this project.</p>
      </header>
      {access.allowed ? <EvidenceList projectId={projectId} /> : <p className="text-sm text-slate-400">{CAPABILITY_DENIAL_COPY.VIEW_EVIDENCE}</p>}
    </div>
  );
}
