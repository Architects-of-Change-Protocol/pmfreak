import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/platform/feature-flags";
import { AgentRunScreen } from "@/modules/agents/screens/AgentRunScreen";

export default async function Page({ params }: { params: Promise<{ workspaceId: string; runId: string }> }) {
  if (!isFeatureEnabled("FEATURE_AGENT_VIEW")) notFound();
  const { workspaceId, runId } = await params;
  return <AgentRunScreen workspaceId={workspaceId} runId={runId} />;
}
