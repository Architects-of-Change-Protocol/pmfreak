/**
 * Terminal-but-recoverable failure for a Command Center activation attempt.
 *
 * Replaces the former ActivationTimeoutState, which offered "Keep Waiting" —
 * an option that did nothing, because savePmoTenant is a single synchronous
 * server action with no background job, worker, or persisted operation to keep
 * observing. Retry here starts a genuinely new attempt, which is safe:
 * savePmoTenant upserts workspace_governance on workspace_id and guards its
 * pmos insert with an existence check, so retrying cannot create duplicates.
 */
export function ActivationFailureState({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry: () => void;
  /** True while a retry attempt is itself in flight — disables the button. */
  retrying: boolean;
}) {
  return (
    <div className="rounded-2xl border border-rose-300/40 bg-rose-50 p-5" role="alert">
      <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-rose-600">Activation failed</p>
      <p className="mb-1 text-sm font-semibold text-slate-900">
        We couldn&apos;t create your Command Center.
      </p>
      <p className="text-sm text-zinc-600">{message}</p>
      <div className="mt-3 flex gap-2.5">
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="rounded-lg border border-rose-300/50 bg-white px-4 py-1.5 text-sm font-medium text-rose-800 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {retrying ? "Retrying…" : "Retry"}
        </button>
      </div>
    </div>
  );
}
