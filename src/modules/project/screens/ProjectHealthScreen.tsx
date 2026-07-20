import { ProjectHealthPanel } from "../features/ProjectHealthPanel";

/** Project Health capability (Fase 4) — "Is this project healthy?", not a traditional dashboard. */
export function ProjectHealthScreen({ projectId }: { projectId: string }) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Project Health</h1>
      </header>
      <ProjectHealthPanel projectId={projectId} />
    </div>
  );
}
