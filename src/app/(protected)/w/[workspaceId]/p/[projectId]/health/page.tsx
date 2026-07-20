import { ProjectHealthScreen } from "@/modules/project/screens/ProjectHealthScreen";

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectHealthScreen projectId={projectId} />;
}
