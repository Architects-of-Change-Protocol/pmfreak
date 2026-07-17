import Link from "next/link";
import { requireAuthUser } from "@/lib/auth";
import { getUserWorkspaces } from "@/lib/workspaces";
import { resolvePreferredWorkspace } from "@/lib/workspaces/preferred-workspace";
import { switchWorkspaceAction } from "./actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string }> };

/**
 * Workspace list — every organization the user belongs to. Level 1 of the
 * Workspace → PMO → Project hierarchy.
 */
export default async function WorkspacesPage({ searchParams }: Props) {
  const user = await requireAuthUser();
  const { error } = await searchParams;
  const [workspaces, resolution] = await Promise.all([
    getUserWorkspaces(user.id),
    resolvePreferredWorkspace(user.id),
  ]);

  return (
    <main className="space-y-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-800">Account</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Workspaces</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-700">
              A workspace is your whole organization — it holds your PMOs, and each PMO holds projects.
            </p>
          </div>
          <Link
            href="/workspaces/new"
            className="rounded-xl border border-cyan-200/45 bg-cyan-400/[0.1] px-4 py-2.5 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-400/[0.16]"
          >
            New Workspace
          </Link>
        </div>
      </header>

      {error ? <p className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-800">{error}</p> : null}

      <section className="grid gap-3 md:grid-cols-2">
        {workspaces.map((workspace) => {
          const isActive = workspace.id === resolution.workspaceId;
          return (
            <article key={workspace.id} className={`rounded-2xl border p-4 ${isActive ? "border-cyan-300/40 bg-cyan-400/[0.06]" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{workspace.name}</h2>
                  {isActive ? <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-800">Active workspace</p> : null}
                </div>
                {!isActive ? (
                  <form action={switchWorkspaceAction}>
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <button type="submit" className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 hover:border-cyan-300/40">
                      Switch
                    </button>
                  </form>
                ) : (
                  <Link href="/pmos" className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 hover:border-cyan-300/40">
                    Open PMOs
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
