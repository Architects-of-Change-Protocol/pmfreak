import Link from "next/link";
import { createWorkspaceAction } from "../actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string }> };

/**
 * New Workspace — the top of the creation flow:
 * Create Workspace → Create PMO → Create Project.
 */
export default async function NewWorkspacePage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl space-y-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-800">
          <Link href="/workspaces" className="hover:text-cyan-900">Workspaces</Link> / New
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Create a Workspace</h1>
        <p className="mt-2 text-sm text-slate-700">
          A workspace represents an entire organization — personal, enterprise, consulting, or agency.
          After creating it you&apos;ll set up its first PMO, then its first project.
        </p>
      </header>

      {error ? <p className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-800">{error}</p> : null}

      <form action={createWorkspaceAction} className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <label className="block space-y-1.5 text-xs uppercase tracking-[0.14em] text-zinc-600">
          Workspace name
          <input
            name="name"
            required
            placeholder="Acme Consulting Workspace"
            className="block w-full rounded-xl border border-slate-200 bg-[#FCFBF9]/75 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500"
          />
        </label>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600">
          <p className="font-semibold uppercase tracking-[0.14em] text-slate-700">What happens next</p>
          <p className="mt-1.5">1. Workspace created and activated</p>
          <p>2. Create its first PMO (Command Center setup)</p>
          <p>3. Create the first project inside that PMO</p>
        </div>
        <button
          type="submit"
          className="rounded-xl border border-cyan-200/45 bg-cyan-400/[0.1] px-4 py-2.5 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-400/[0.16]"
        >
          Create Workspace
        </button>
      </form>
    </main>
  );
}
