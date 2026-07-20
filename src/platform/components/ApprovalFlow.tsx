"use client";

import { useEffect, useRef, useState } from "react";

type PendingState = "idle" | "confirming" | "submitting" | "succeeded" | "failed";

/**
 * The shared two-action (approve/reject) governed-approval interaction
 * behind ApproveAgentProposal / RejectAgentProposal / ApproveRecommendation /
 * RecordDecision (08-ai-interaction-patterns.md §6). Confirmation-gated,
 * traps focus until resolved or dismissed with Escape, and announces
 * pending/success/error via ARIA rather than only a disabled-button style
 * (08-accessibility-guidelines.md §2–§3). The component only emits intent —
 * the owning Feature performs the actual Command dispatch, including the
 * Idempotency-Key (08-design-system.md §4).
 */
export function ApprovalFlow({
  itemLabel,
  onApprove,
  onReject,
  disabled,
  disabledReason,
}: {
  itemLabel: string;
  onApprove: () => Promise<void>;
  onReject: (reason?: string) => Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, setState] = useState<PendingState>("idle");
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (state !== "confirming" || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const focusable = dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setState("idle");
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [state]);

  function requestConfirmation(action: "approve" | "reject") {
    setPendingAction(action);
    setState("confirming");
  }

  async function confirm() {
    if (!pendingAction) return;
    setState("submitting");
    setError(null);
    try {
      if (pendingAction === "approve") await onApprove();
      else await onReject();
      setState("succeeded");
    } catch {
      setState("failed");
      setError(`Unable to ${pendingAction} this item. Retry.`);
    }
  }

  if (disabled) {
    return <p className="text-sm text-slate-400">{disabledReason ?? "You do not have permission to act on this item."}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2" role="group" aria-label={`Approval actions for ${itemLabel}`}>
        <button
          ref={triggerRef}
          type="button"
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:opacity-50"
          onClick={() => requestConfirmation("approve")}
          disabled={state === "submitting" || state === "succeeded"}
        >
          Approve
        </button>
        <button
          type="button"
          className="rounded-md border border-red-400/50 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-300 disabled:opacity-50"
          onClick={() => requestConfirmation("reject")}
          disabled={state === "submitting" || state === "succeeded"}
        >
          Reject
        </button>
      </div>

      <div role="status" aria-live="polite" className="text-sm">
        {state === "submitting" && <span className="text-slate-400">Submitting…</span>}
        {state === "succeeded" && <span className="text-emerald-400">{pendingAction === "approve" ? "Approved." : "Rejected."}</span>}
        {state === "failed" && <span className="text-red-400">{error}</span>}
      </div>

      {state === "confirming" ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Confirm ${pendingAction} for ${itemLabel}`}
          className="flex flex-col gap-3 rounded-md border border-slate-500/40 bg-slate-900 p-4"
        >
          <p className="text-sm text-slate-100">
            {pendingAction === "approve" ? `Approve ${itemLabel}?` : `Reject ${itemLabel}?`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-500"
              onClick={confirm}
            >
              Confirm
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-400/40 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
              onClick={() => {
                setState("idle");
                triggerRef.current?.focus();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
