// ─── Agent Tool Approval — Policy ────────────────────────────────────────────

import type { AgentToolRecord } from "./agent-tool-types";

export type ApprovalRequirementResult = {
  required: boolean;
  reason: string | null;
};

/**
 * Determine whether a given tool requires human approval before use.
 * This is the single authoritative policy check — covers both explicit
 * requires_human_approval flags and risk-level-based rules.
 */
export function requiresApprovalForTool(
  tool: AgentToolRecord
): ApprovalRequirementResult {
  // Explicit flag always wins
  if (tool.requiresHumanApproval) {
    return {
      required: true,
      reason: "Tool is explicitly configured to require human approval.",
    };
  }

  // Execution mode implies approval requirement
  if (tool.executionMode === "requires_approval") {
    return {
      required: true,
      reason: "Tool execution mode is 'requires_approval'.",
    };
  }

  // Critical risk tools always require approval
  if (tool.riskLevel === "critical") {
    return {
      required: true,
      reason: "Tool risk level is 'critical' — human approval is always required.",
    };
  }

  // State-mutating high-risk tools require approval
  if (tool.riskLevel === "high" && tool.mutatesState) {
    return {
      required: true,
      reason: "Tool is high-risk and mutates state — human approval is required.",
    };
  }

  return { required: false, reason: null };
}
