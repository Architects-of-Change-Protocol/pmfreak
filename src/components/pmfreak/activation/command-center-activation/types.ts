import type { AgentId } from "@/lib/pmo/pmo-tenant-types";

// ─── State machine vocabulary ──────────────────────────────────────────────
//
// Error/timeout/cancelled are intentionally NOT terminal statuses here.
// create-pmo-wizard.tsx already owns error handling (createError /
// createErrorClass) with its own tested contract — this machine only models
// the "things are going well" path (click → server confirms → initialize →
// ready) plus a timeout flag layered on top of "request_sent". On failure,
// the wizard calls reset() and its existing inline error UI takes over.

export type ActivationStatus =
  | "idle"
  | "activation_started"
  | "request_sent"
  | "created"
  | "initializing"
  | "ready";

export type InitializationStageId =
  | "context"
  | "graph"
  | "memory"
  | "agents"
  | "signals"
  | "executive-picture"
  | "dashboard-prep";

export type AgentConnectionStatus = "dormant" | "connecting" | "online";

export type ActivationState = {
  status: ActivationStatus;
  /** The stage currently in progress (in the "initializing" status only). */
  currentStageId: InitializationStageId | null;
  /** Stages that have already finished, in completion order — lets a rendered list show checkmarks for prior stages while the current one animates. */
  completedStageIds: InitializationStageId[];
  /** Per-agent connection status, keyed by AgentId, for the "agents" stage. Only enabled agents ever appear here. */
  agentStatuses: Partial<Record<AgentId, AgentConnectionStatus>>;
  /** True while "request_sent" has exceeded the configured timeout — an overlay flag, not a new status. */
  timedOut: boolean;
};

export const INITIAL_ACTIVATION_STATE: ActivationState = {
  status: "idle",
  currentStageId: null,
  completedStageIds: [],
  agentStatuses: {},
  timedOut: false,
};

// ─── Progress events ────────────────────────────────────────────────────────
//
// Any progress source (timer-driven today, SSE/WebSocket-driven in the
// future) emits this same event shape. Nothing downstream needs to change
// when the source changes.

export type ActivationProgressEvent =
  | { type: "stage-start"; stageId: InitializationStageId }
  | { type: "stage-complete"; stageId: InitializationStageId }
  | { type: "agent-connecting"; agentId: AgentId }
  | { type: "agent-online"; agentId: AgentId }
  | { type: "sequence-complete" };

export type ActivationProgressListener = (event: ActivationProgressEvent) => void;

/**
 * Anything that can drive the initialization sequence. `createTimerProgressSource`
 * is the only implementation today. A future `createSseProgressSource(correlationId)`
 * could subscribe to server-pushed events and emit this same event shape —
 * the hook and every component below are agnostic to where events come from.
 */
export type ProgressSource = {
  start(context: { enabledAgentIds: AgentId[] }): void;
  subscribe(listener: ActivationProgressListener): () => void;
  stop(): void;
};
