import type { InitializationStageId } from "./types";

// ─── Timing ─────────────────────────────────────────────────────────────────
//
// Everything here is configuration, not a scattering of magic numbers through
// the components. Change text, duration, or enabled flags in one place.

/** How long "request_sent" can run before showing the "still working" overlay. Re-arms on Keep Waiting. */
export const DEFAULT_TIMEOUT_MS = 15_000;

/** How long each agent lingers in "connecting" before flipping to "online". */
export const AGENT_CONNECT_DURATION_MS = 450;

/** How long the "✓ Command Center Created" confirmation lingers before initialization begins. */
export const CREATED_CONFIRMATION_DURATION_MS = 500;

export type InitializationStageConfig = {
  id: InitializationStageId;
  /** Copy shown while the stage is in progress. */
  label: string;
  /** Copy shown once the stage completes. */
  completeLabel: string;
  /**
   * Fixed duration for this stage, in ms. The "agents" stage ignores this —
   * its duration is derived from the number of enabled agents instead
   * (see AGENT_CONNECT_DURATION_MS).
   */
  durationMs: number;
  /** Set to false to skip this stage entirely. */
  enabled: boolean;
};

export const INITIALIZATION_STAGES: InitializationStageConfig[] = [
  {
    id: "context",
    label: "Reading Context Seed…",
    completeLabel: "Context Loaded",
    durationMs: 900,
    enabled: true,
  },
  {
    id: "graph",
    label: "Building Operational Graph…",
    completeLabel: "Operational Graph Ready",
    durationMs: 900,
    enabled: true,
  },
  {
    id: "memory",
    label: "Loading Organizational Memory…",
    completeLabel: "Workspace Memory Synchronized",
    durationMs: 900,
    enabled: true,
  },
  {
    id: "agents",
    label: "Activating Intelligence Network…",
    completeLabel: "Intelligence Network Online",
    durationMs: 0,
    enabled: true,
  },
  {
    id: "signals",
    label: "Indexing Operational Context…",
    completeLabel: "Operational Context Indexed",
    durationMs: 1100,
    enabled: true,
  },
  {
    id: "executive-picture",
    label: "Generating Executive Picture…",
    completeLabel: "Executive Picture Ready",
    durationMs: 900,
    enabled: true,
  },
  {
    id: "dashboard-prep",
    label: "Preparing Operational Dashboard…",
    completeLabel: "Dashboard Ready",
    durationMs: 700,
    enabled: true,
  },
];

export function activeInitializationStages(): InitializationStageConfig[] {
  return INITIALIZATION_STAGES.filter((s) => s.enabled);
}
