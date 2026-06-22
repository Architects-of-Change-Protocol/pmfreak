import { ExecutionBoard } from "@/components/program-builder/ExecutionBoard";

export default async function ProgramBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ExecutionBoard programId={id} />;
}
