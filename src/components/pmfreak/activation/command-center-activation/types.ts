// ─── Activation state machine ──────────────────────────────────────────────
//
// Every visible state here corresponds to a real system state.
//
// savePmoTenant is a single synchronous server action: it either completes all
// of its writes and returns success, or it catches, rolls back its governance
// upsert, and returns a typed failure. There is no queue, no worker, and no
// post-persistence initialization phase — so there is nothing to poll and
// nothing to "keep waiting" for.
//
// The previous machine modelled created -> initializing -> ready driven by
// setTimeout, animating provisioning/memory/agent stages that no backend
// operation performed. That has been removed entirely rather than relabelled:
// simulated progress is indistinguishable from a lie to the user, and it hid a
// real hang (a rejected save stranded the UI in request_sent forever).
//
// Persisted domain state remains exactly two values — not activated, and
// activated (workspace_governance row + workspaces.command_center_type). None
// of the statuses below are persisted; they describe only this client's own
// in-flight request.

export type ActivationStatus =
  | "idle"
  /** The server action is in flight. The only truthful "working" state. */
  | "submitting"
  /** The server action returned success. Brief confirmation, then navigation. */
  | "success"
  /** The attempt failed or never resolved. Recoverable — Retry starts a new attempt. */
  | "failure";

export type ActivationState = {
  status: ActivationStatus;
  /** Honest, user-facing reason shown in the failure state. Null unless status is "failure". */
  error: string | null;
  /** 1 for the first attempt, incremented per retry. Diagnostics only — never implies progress. */
  attempt: number;
};

export const INITIAL_ACTIVATION_STATE: ActivationState = {
  status: "idle",
  error: null,
  attempt: 0,
};
