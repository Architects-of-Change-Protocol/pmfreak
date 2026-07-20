/**
 * Displays the active Enterprise context only. No multi-Enterprise backend
 * to switch between exists yet in this slice — intentionally minimal,
 * documented stub (ADR-PMF-075), not hidden.
 */
export function EnterpriseSwitcher({ companyName }: { companyName: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
      <span aria-hidden="true">🏢</span>
      <span>{companyName}</span>
    </div>
  );
}
