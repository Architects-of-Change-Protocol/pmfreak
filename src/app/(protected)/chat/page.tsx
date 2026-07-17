import Link from "next/link";
import { requireAuthUser } from "@/lib/auth";
import { resolvePreferredWorkspace } from "@/lib/workspaces/preferred-workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listPmosWithProjects } from "@/lib/pmos/pmo-service";
import { ContextChatPanel } from "@/components/pmfreak/chat/context-chat-panel";

export const dynamic = "force-dynamic";

/**
 * Workspace Chat — the workspace-level conversational console.
 * Context: every PMO in the workspace (and nothing outside it).
 */
export default async function WorkspaceChatPage() {
  const user = await requireAuthUser();
  const resolution = await resolvePreferredWorkspace(user.id);
  if (!resolution.workspaceId) {
    return <main className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-700">No active workspace. Create one to start.</main>;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: workspace }, pmos] = await Promise.all([
    supabase.from("workspaces").select("id, name").eq("id", resolution.workspaceId).maybeSingle<{ id: string; name: string }>(),
    listPmosWithProjects(resolution.workspaceId),
  ]);

  const totalProjects = pmos.reduce((sum, pmo) => sum + pmo.projects.length, 0);
  const activeProjects = pmos.reduce((sum, pmo) => sum + pmo.projects.filter((p) => p.status === "active").length, 0);

  return (
    <main className="space-y-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-800">Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{workspace?.name ?? "Workspace"} — Chat</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-700">
          Global questions about your whole operation. This conversation sees every PMO in this workspace — and nothing beyond it.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">PMOs</p>
            <p className="mt-1 text-lg font-semibold text-cyan-800">{pmos.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Projects</p>
            <p className="mt-1 text-lg font-semibold text-cyan-800">{totalProjects}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Active</p>
            <p className="mt-1 text-lg font-semibold text-emerald-800">{activeProjects}</p>
          </div>
        </div>
        {pmos.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            No PMOs yet. <Link href="/pmos" className="text-cyan-800 underline-offset-2 hover:underline">Create your first PMO</Link> to organize projects.
          </p>
        ) : null}
      </header>

      <ContextChatPanel
        contextType="workspace"
        title="Workspace Conversation"
        subtitle="Aggregates every PMO in this workspace. Never mixes with PMO or project chats."
        placeholder="How many projects do I have? Which PMOs carry the most risk?"
        suggestions={[
          "How many projects do I have?",
          "Which projects need attention today?",
          "Which risks are open across the workspace?",
          "Generate an executive summary",
        ]}
      />
    </main>
  );
}
