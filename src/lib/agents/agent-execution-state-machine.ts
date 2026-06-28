// ─── Agent Execution Request Runtime — State Machine ─────────────────────────

import type { AgentExecutionState } from "./agent-execution-types";

const TRANSITIONS: Record<AgentExecutionState, AgentExecutionState[]> = {
  draft: ["pending_preflight", "cancelled"],
  pending_preflight: ["ready_for_execution", "pending_approval", "preflight_failed", "blocked", "cancelled"],
  preflight_failed: ["pending_preflight", "cancelled", "expired"],
  blocked: ["cancelled", "expired"],
  pending_approval: ["approved", "blocked", "cancelled", "expired"],
  approved: ["ready_for_execution", "cancelled", "expired"],
  ready_for_execution: ["completed", "failed", "cancelled", "expired"],
  executing: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
  expired: [],
};

export function canTransitionAgentExecutionState(input: { from: AgentExecutionState; to: AgentExecutionState }): boolean {
  const allowed = TRANSITIONS[input.from];
  return allowed ? allowed.includes(input.to) : false;
}

export function getAllowedAgentExecutionTransitions(state: AgentExecutionState): AgentExecutionState[] {
  return TRANSITIONS[state] ?? [];
}

export function assertAgentExecutionTransition(input: { from: AgentExecutionState; to: AgentExecutionState }): void {
  if (!canTransitionAgentExecutionState(input)) {
    throw new Error(
      `Invalid agent execution state transition: ${input.from} -> ${input.to}. ` +
      `Allowed transitions from ${input.from}: [${getAllowedAgentExecutionTransitions(input.from).join(", ")}]`
    );
  }
}
