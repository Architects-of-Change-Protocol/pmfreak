/**
 * Shown as an overlay on top of "request_sent" once DEFAULT_TIMEOUT_MS has
 * elapsed without a response. Never cancels the underlying request — Keep
 * Waiting just dismisses this and keeps listening; Retry re-runs activation
 * from scratch, which is safe because savePmoTenant's upsert is idempotent.
 */
export function ActivationTimeoutState({
  onKeepWaiting,
  onRetry,
}: {
  onKeepWaiting: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-amber-300/40 bg-amber-50 p-5" role="alert">
      <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-amber-600">Still working…</p>
      <p className="mb-1 text-sm font-semibold text-slate-900">
        Creating your Command Center is taking longer than expected.
      </p>
      <p className="text-sm text-zinc-500">This is usually caused by a slow backend response.</p>
      <div className="mt-3 flex gap-2.5">
        <button
          type="button"
          onClick={onKeepWaiting}
          className="rounded-lg border border-amber-300/50 bg-white px-4 py-1.5 text-sm font-medium text-amber-800 transition hover:bg-amber-50"
        >
          Keep Waiting
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-amber-300/50 px-4 py-1.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100/60"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
