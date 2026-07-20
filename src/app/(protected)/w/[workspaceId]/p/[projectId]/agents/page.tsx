import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/platform/feature-flags";
import { AgentRegistryScreen } from "@/modules/agents/screens/AgentRegistryScreen";

export default async function Page({ params }: { params: Promise<{ workspaceId: string; projectId: string }> }) {
  if (!isFeatureEnabled("FEATURE_AGENT_VIEW")) notFound();
  const { workspaceId, projectId } = await params;
  return <AgentRegistryScreen workspaceId={workspaceId} projectId={projectId} />;
}
