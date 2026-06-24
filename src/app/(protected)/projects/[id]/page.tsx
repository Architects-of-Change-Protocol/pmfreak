import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { evaluateCapabilityAccess } from "@/lib/security/capability-flow";
import { resolveCanonicalProject } from "@/lib/projects/canonical-project-resolver";
import { redirect } from "next/navigation";
import { ProjectPMAssignment } from "@/components/pmfreak/ProjectPMAssignment";

type Props = { params: Promise<{ id: string }> };

export default async function ProjectDetailPage({ params }: Props) {
  await requireAuthUser();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, workspace_id, name, description, status")
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  const canonicalProject = await resolveCanonicalProject(project.workspace_id, id);
  if (canonicalProject.status === "invalid" && canonicalProject.projectId) {
    redirect(`/projects/${canonicalProject.projectId}?recoveredFrom=invalidProject`);
  }

  await evaluateCapabilityAccess({ workspaceId: project.workspace_id, projectId: project.id, permission: "read" });

  const { data: analyses } = await supabase
    .from("onboarding_analyses")
    .select("id, analysis, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <main className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl md:p-10 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
        <p className="mt-2 text-sm text-slate-300">{project.description ?? "No description provided."}</p>
        <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">Status: {project.status}</p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/20 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Run PMFreak AI</h2>
          <Link
            href={`/upload?projectId=${project.id}`}
            className="rounded-xl border border-cyan-300/50 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/10"
          >
            Upload documents for this project
          </Link>
        </div>
        <form action="/api/analyze-ai" method="post" className="mt-3 space-y-3">
          <input type="hidden" name="projectId" value={project.id} />
          <input name="projectName" defaultValue={project.name} required className="w-full rounded-xl border border-white/15 bg-white/30 px-3 py-2 text-sm" />
          <textarea name="extractedScopeText" required placeholder="Paste scope text to analyze" rows={6} className="w-full rounded-xl border border-white/15 bg-white/30 px-3 py-2 text-sm" />
          <button type="submit" className="rounded-xl border border-cyan-300/50 px-4 py-2 text-sm font-semibold">Analyze</button>
        </form>
      </section>

      <ProjectPMAssignment projectId={project.id} />

      <section>
        <h2 className="text-lg font-semibold">Previous analyses</h2>
        <ul className="mt-3 space-y-3">
          {(analyses ?? []).length === 0 ? <li className="text-sm text-slate-300">No analyses yet for this project.</li> : null}
          {(analyses ?? []).map((row) => (
            <li key={row.id} className="rounded-2xl border border-white/10 bg-white/20 p-4">
              <p className="text-xs text-slate-400">{new Date(row.created_at).toLocaleString()}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{row.analysis}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
