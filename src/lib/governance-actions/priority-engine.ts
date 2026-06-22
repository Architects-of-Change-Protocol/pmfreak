// ─────────────────────────────────────────────────────────────────────────────
// Governance Action Engine — Priority Engine
//
// Derives action priority from signal severity, governance impact, time
// sensitivity, and historical outcome data.
// ─────────────────────────────────────────────────────────────────────────────

import type { GovernanceActionPriority } from "./types";
import type { GovernanceSignalType } from "@/lib/governance-signals/types";

const SEVERITY_BASE_PRIORITY: Record<string, GovernanceActionPriority> = {
  critical: "critical",
  high:     "high",
  medium:   "medium",
  low:      "low",
};

// Signal types that always escalate to at least high
const HIGH_IMPACT_SIGNAL_TYPES = new Set<GovernanceSignalType>([
  "governance_violation",
  "authority_gap",
  "escalation_gap",
]);

// Signal types that always escalate to at least medium
const MEDIUM_IMPACT_SIGNAL_TYPES = new Set<GovernanceSignalType>([
  "approval_delay",
  "ratification_stall",
  "decision_bottleneck",
  "amendment_backlog",
  "risk_accumulation",
]);

const PRIORITY_RANK: Record<GovernanceActionPriority, number> = {
  low:      0,
  medium:   1,
  high:     2,
  critical: 3,
};

const RANK_TO_PRIORITY: GovernanceActionPriority[] = ["low", "medium", "high", "critical"];

function escalate(
  base: GovernanceActionPriority,
  levels: number
): GovernanceActionPriority {
  const rank = Math.min(3, PRIORITY_RANK[base] + levels);
  return RANK_TO_PRIORITY[rank];
}

export type ActionPriorityFactors = {
  signalSeverity: string;
  signalType: GovernanceSignalType;
  confidenceScore: number;
  durationDays?: number;
  hasHistoricalNegativeOutcome?: boolean;
};

export type ActionPriorityResult = {
  priority: GovernanceActionPriority;
  reasoning: string[];
};

export function calculateActionPriority(
  factors: ActionPriorityFactors
): ActionPriorityResult {
  const reasoning: string[] = [];
  let priority: GovernanceActionPriority =
    SEVERITY_BASE_PRIORITY[factors.signalSeverity] ?? "medium";

  reasoning.push(`Base priority from signal severity '${factors.signalSeverity}': ${priority}`);

  if (HIGH_IMPACT_SIGNAL_TYPES.has(factors.signalType)) {
    const before = priority;
    priority = escalate(priority, 1);
    if (priority !== before) {
      reasoning.push(`Escalated +1 level due to high-impact signal type '${factors.signalType}'`);
    }
  } else if (MEDIUM_IMPACT_SIGNAL_TYPES.has(factors.signalType)) {
    const minPriority: GovernanceActionPriority = "medium";
    if (PRIORITY_RANK[priority] < PRIORITY_RANK[minPriority]) {
      priority = minPriority;
      reasoning.push(`Elevated to minimum '${minPriority}' for signal type '${factors.signalType}'`);
    }
  }

  if ((factors.durationDays ?? 0) >= 15) {
    priority = escalate(priority, 2);
    reasoning.push("Escalated +2 levels: duration >= 15 days");
  } else if ((factors.durationDays ?? 0) >= 8) {
    priority = escalate(priority, 1);
    reasoning.push("Escalated +1 level: duration >= 8 days");
  }

  if (factors.hasHistoricalNegativeOutcome) {
    priority = escalate(priority, 1);
    reasoning.push("Escalated +1 level: historical negative outcome pattern");
  }

  if (factors.confidenceScore >= 0.90) {
    reasoning.push(`High confidence (${factors.confidenceScore.toFixed(3)}) reinforces priority`);
  }

  reasoning.push(`Final priority: ${priority}`);

  return { priority, reasoning };
}
