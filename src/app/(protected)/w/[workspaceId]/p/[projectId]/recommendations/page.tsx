import { RecommendationRegisterScreen } from "@/modules/recommendations/screens/RecommendationRegisterScreen";

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <RecommendationRegisterScreen projectId={projectId} />;
}
