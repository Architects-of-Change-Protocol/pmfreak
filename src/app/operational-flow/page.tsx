import { MaterialActionPanel } from "@/components/pmfreak/intelligence-inbox/material-action-panel";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { connection } from "next/server";

export default async function OperationalFlowPage({ searchParams }: { searchParams: Promise<{ workspaceId?: string; projectId?: string }> }) {
  await connection();
  await requireAuthenticatedUser();
  const { workspaceId = "", projectId = "" } = await searchParams;
  return <main className="mx-auto min-h-screen w-full max-w-5xl bg-[#fcfbf9] px-4 py-8 text-zinc-950 sm:px-6">
    <header className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">P2-06 · DEMO / FIXTURE capable</p>
      <h1 className="mt-2 text-2xl font-semibold">Governed Decision-to-Action</h1>
      <p className="mt-2 text-sm text-zinc-600">Authenticated feature surface for inspecting the in-process AOC-E boundary. Workspace and Project authorization remains enforced by the operational-flow API.</p>
    </header>
    {workspaceId && projectId
      ? <MaterialActionPanel workspaceId={workspaceId} projectId={projectId} />
      : <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">A Workspace and Project are required.</p>}
  </main>;
}
