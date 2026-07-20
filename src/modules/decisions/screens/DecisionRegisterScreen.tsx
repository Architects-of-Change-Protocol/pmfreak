import { DecisionList } from "../features/DecisionList";

/** Decisions screen (03-screen-catalog.md §9) — List view. */
export function DecisionRegisterScreen({ projectId }: { projectId: string }) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Decisions</h1>
        <p className="text-sm text-slate-400">Every decision recorded for this project, with its evidence and approval trail.</p>
      </header>
      <DecisionList projectId={projectId} title="All Decisions" emptyMessage="No decisions recorded yet." />
    </div>
  );
}
