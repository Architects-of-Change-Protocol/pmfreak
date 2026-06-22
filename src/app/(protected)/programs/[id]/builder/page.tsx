import { ProgramBuilderView } from "@/components/program-builder/ProgramBuilderView";

export default async function ProgramBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProgramBuilderView programId={id} />;
}
