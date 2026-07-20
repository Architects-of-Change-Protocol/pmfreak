import { ProjectCommandCenterScreen } from "@/modules/project/screens/ProjectCommandCenterScreen";

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectCommandCenterScreen projectId={projectId} />;
}
