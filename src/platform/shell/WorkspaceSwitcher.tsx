/**
 * Displays the active Workspace only (Session State per
 * 07-frontend-state-and-data-architecture.md §6, never localStorage/URL
 * authority). This slice has one real membership resolved server-side
 * (resolveWriteWorkspace) — actual cross-Workspace switching is out of
 * scope (documented stub, ADR-PMF-075).
 */
export function WorkspaceSwitcher({ workspaceName }: { workspaceName: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-500/25 px-3 py-1.5 text-sm text-slate-200">
      <span aria-hidden="true">🗂️</span>
      <span>{workspaceName}</span>
    </div>
  );
}
