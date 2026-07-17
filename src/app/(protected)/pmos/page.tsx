import { requireAuthUser } from "@/lib/auth";
import { resolvePreferredWorkspace } from "@/lib/workspaces/preferred-workspace";
import { listPmosWithProjects } from "@/lib/pmos/pmo-service";
import { PmoAdminClient } from "@/components/pmfreak/pmos/pmo-admin-client";

export const dynamic = "force-dynamic";

/**
 * PMO administration — Workspace level. Create, edit, archive, duplicate and
 * delete the PMOs that group this workspace's projects.
 */
export default async function PmosPage() {
  const user = await requireAuthUser();
  const resolution = await resolvePreferredWorkspace(user.id);
  if (!resolution.workspaceId) {
    return <main className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-700">No active workspace.</main>;
  }

  const pmos = await listPmosWithProjects(resolution.workspaceId, { includeArchived: true });

  return (
    <main className="space-y-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-800">Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">PMOs</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-700">
          A PMO groups and governs a set of projects — one per client, division, or program. Your workspace can hold as many as you need.
        </p>
      </header>
      <PmoAdminClient initialPmos={pmos} />
    </main>
  );
}
