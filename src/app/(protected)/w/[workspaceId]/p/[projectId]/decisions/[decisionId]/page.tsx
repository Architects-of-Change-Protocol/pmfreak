import { DecisionDetailScreen } from "@/modules/decisions/screens/DecisionDetailScreen";

export default async function Page({ params }: { params: Promise<{ workspaceId: string; projectId: string; decisionId: string }> }) {
  const { workspaceId, projectId, decisionId } = await params;
  return <DecisionDetailScreen projectId={projectId} decisionId={decisionId} evidenceHref={`/w/${workspaceId}/p/${projectId}/evidence`} />;
}
