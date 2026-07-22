// ─── Timing ─────────────────────────────────────────────────────────────────
//
// Configuration, not magic numbers scattered through components.
//
// The former INITIALIZATION_STAGES roster was removed with the simulated
// provisioning sequence: those stages animated work ("Provisioning Workspace
// Structure…", "Preparing Memory Store…", "Activating Governance Agents…")
// that no backend operation actually performed. Only real timings remain.

/**
 * Guard against a savePmoTenant promise that never settles. This is NOT a
 * "still working" hint — when it fires, the attempt is declared failed and the
 * user is given Retry. Nothing continues in the background.
 */
export const SUBMIT_TIMEOUT_MS = 20_000;

/**
 * How long the success confirmation is shown before navigating. Purely an
 * acknowledgement that activation completed — it must never suggest that
 * further setup is still running.
 */
export const SUCCESS_CONFIRMATION_DURATION_MS = 800;
