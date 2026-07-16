import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { evaluateCapabilityAccess } from "@/lib/security/capability-flow";
import { listPmos } from "@/lib/pmos/pmo-service";
import { ProjectSettingsClient } from "@/components/pmfreak/projects/project-settings-client";
import { ProjectTabNav } from "../project-tab-nav";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * Project Settings — rename, restatus, move between PMOs, change
 * methodology/icon/color, duplicate, or delete this project.
 */
export default async function ProjectSettingsPage({ params }: Props) {
  await requireAuthUser();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, workspace_id, pmo_id, name, description, status, methodology, icon, color")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  await evaluateCapabilityAccess({ workspaceId: project.workspace_id, projectId: project.id, permission: "write" });

  const pmos = await listPmos(project.workspace_id);

  return (
    <main className="space-y-5">
      <header className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-200">
          <Link href={`/projects/${project.id}`} className="hover:text-cyan-100">{project.name}</Link> / Settings
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          {project.icon ? <span className="mr-2">{project.icon}</span> : null}
          {project.name} — Settings
        </h1>
        <div className="mt-4">
          <ProjectTabNav projectId={project.id} active="settings" />
        </div>
      </header>

      <ProjectSettingsClient
        project={{
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          methodology: project.methodology,
          icon: project.icon,
          color: project.color,
          pmo_id: project.pmo_id,
        }}
        pmos={pmos.map((pmo) => ({ id: pmo.id, name: pmo.name, icon: pmo.icon }))}
      />
    </main>
  );
}
