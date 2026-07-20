import type { ReactNode } from "react";

/**
 * Shared per-zone state wrapper for the Project Command Center's four zones
 * (08-command-center-experience.md §5). Each zone independently implements
 * Loading (skeleton matching populated shape) / Populated / Empty (stated
 * positive) / Error (scoped retry) — one zone's failure never blanks the
 * other three.
 */
export function ZoneFrame({
  title,
  isLoading,
  error,
  isEmpty,
  emptyMessage,
  onRetry,
  children,
}: {
  title: string;
  isLoading: boolean;
  error: unknown;
  isEmpty: boolean;
  emptyMessage: string;
  onRetry?: () => void;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-xl border border-slate-500/25 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
      {isLoading ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-500/20" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-500/20" />
        </div>
      ) : error ? (
        <div role="alert" className="flex flex-col gap-2 text-sm text-red-300">
          <p>Unable to load {title.toLowerCase()}.</p>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="w-fit rounded-md border border-red-400/40 px-3 py-1 text-xs hover:bg-red-500/10">
              Retry
            </button>
          ) : null}
        </div>
      ) : isEmpty ? (
        <p className="text-sm text-slate-400">{emptyMessage}</p>
      ) : (
        children
      )}
    </section>
  );
}
