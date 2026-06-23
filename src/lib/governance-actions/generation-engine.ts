// ─────────────────────────────────────────────────────────────────────────────
// Governance Action Engine — Action Generation Engine
//
// Deterministic rules map signal types to action candidates.
// No ML/LLM required. Rules are applied per signal type.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ActionCandidate,
  GovernanceActionType,
  GovernanceActionPriority,
} from "./types";
import type { GovernanceSignalType } from "@/lib/governance-signals/types";
import { calculateActionPriority } from "./priority-engine";
import { calculateActionConfidence } from "./confidence-engine";
import { calculateRecommendedDueDate } from "./deadline-engine";
import { getRecommendedOwnerTypeForAction } from "./authority-engine";
import { generateActionJustification } from "./justification-engine";

export type SignalContext = {
  signalType: GovernanceSignalType;
  signalTitle: string;
  signalSeverity: string;
  confidenceScore: number;
  durationDays?: number;
};

type SignalRule = {
  actionType: GovernanceActionType;
  basePriority: GovernanceActionPriority;
  titleTemplate: (ctx: SignalContext) => string;
  descriptionTemplate: (ctx: SignalContext) => string;
  supportingPatterns: string[];
  historicalOccurrences: number;
  recommendationConfidence: number;
  learningConfidence: number;
  historicalEffectiveness: number;
};

const SIGNAL_RULES: Record<GovernanceSignalType, SignalRule[]> = {
  approval_delay: [
    {
      actionType:               "request_approval",
      basePriority:             "high",
      titleTemplate:            () => "Request immediate approval to unblock governance progress",
      descriptionTemplate:      (ctx) => `An approval delay has been detected (${ctx.signalTitle}). Escalate to the responsible approval authority to resolve the blocking state.`,
      supportingPatterns:       ["approval_delay", "delivery_drift"],
      historicalOccurrences:    117,
      recommendationConfidence: 0.78,
      learningConfidence:       0.72,
      historicalEffectiveness:  0.80,
    },
  ],
  authority_gap: [
    {
      actionType:               "create_delegation",
      basePriority:             "critical",
      titleTemplate:            () => "Create delegation to fill authority gap",
      descriptionTemplate:      (ctx) => `An authority gap has been detected (${ctx.signalTitle}). A formal delegation must be established to restore constitutional authority.`,
      supportingPatterns:       ["authority_gap", "governance_violation"],
      historicalOccurrences:    43,
      recommendationConfidence: 0.82,
      learningConfidence:       0.75,
      historicalEffectiveness:  0.85,
    },
    {
      actionType:               "assign_authority",
      basePriority:             "high",
      titleTemplate:            () => "Assign missing authority to a qualified actor",
      descriptionTemplate:      (ctx) => `No authority holder exists for the required governance function (${ctx.signalTitle}). Assign a qualified actor to fill the role.`,
      supportingPatterns:       ["authority_gap"],
      historicalOccurrences:    38,
      recommendationConfidence: 0.75,
      learningConfidence:       0.68,
      historicalEffectiveness:  0.78,
    },
  ],
  escalation_gap: [
    {
      actionType:               "create_escalation",
      basePriority:             "critical",
      titleTemplate:            () => "Create escalation to address unresolved governance issue",
      descriptionTemplate:      (ctx) => `A high-severity signal exists without a corresponding escalation (${ctx.signalTitle}). Create a formal escalation to route the issue to the appropriate authority.`,
      supportingPatterns:       ["escalation_gap", "governance_violation"],
      historicalOccurrences:    89,
      recommendationConfidence: 0.85,
      learningConfidence:       0.77,
      historicalEffectiveness:  0.82,
    },
  ],
  amendment_backlog: [
    {
      actionType:               "review_amendment",
      basePriority:             "medium",
      titleTemplate:            () => "Review and process pending amendments",
      descriptionTemplate:      (ctx) => `Multiple amendments are pending review (${ctx.signalTitle}). Process the amendment backlog to restore constitutional currency.`,
      supportingPatterns:       ["amendment_backlog", "ratification_stall"],
      historicalOccurrences:    61,
      recommendationConfidence: 0.70,
      learningConfidence:       0.65,
      historicalEffectiveness:  0.75,
    },
  ],
  governance_violation: [
    {
      actionType:               "initiate_governance_review",
      basePriority:             "critical",
      titleTemplate:            () => "Initiate formal governance review",
      descriptionTemplate:      (ctx) => `A governance violation has been detected (${ctx.signalTitle}). A formal review must be initiated to restore constitutional order and prevent recurrence.`,
      supportingPatterns:       ["governance_violation"],
      historicalOccurrences:    29,
      recommendationConfidence: 0.90,
      learningConfidence:       0.83,
      historicalEffectiveness:  0.88,
    },
  ],
  recommendation_ignored: [
    {
      actionType:               "reassess_recommendation",
      basePriority:             "medium",
      titleTemplate:            () => "Reassess ignored governance recommendation",
      descriptionTemplate:      (ctx) => `A prior recommendation has not been acted upon (${ctx.signalTitle}). Reassess whether the recommendation remains valid and escalate if necessary.`,
      supportingPatterns:       ["recommendation_ignored", "governance_violation"],
      historicalOccurrences:    54,
      recommendationConfidence: 0.65,
      learningConfidence:       0.60,
      historicalEffectiveness:  0.70,
    },
  ],
  ratification_stall: [
    {
      actionType:               "request_ratification",
      basePriority:             "high",
      titleTemplate:            () => "Request overdue ratification to unblock constitutional process",
      descriptionTemplate:      (ctx) => `A ratification process has stalled (${ctx.signalTitle}). Request immediate ratification from the responsible authority.`,
      supportingPatterns:       ["ratification_stall", "amendment_backlog"],
      historicalOccurrences:    47,
      recommendationConfidence: 0.75,
      learningConfidence:       0.68,
      historicalEffectiveness:  0.79,
    },
  ],
  decision_bottleneck: [
    {
      actionType:               "review_decision",
      basePriority:             "medium",
      titleTemplate:            () => "Review stalled decision to restore decision flow",
      descriptionTemplate:      (ctx) => `A decision has been pending beyond acceptable thresholds (${ctx.signalTitle}). Review the decision to unblock the governance pipeline.`,
      supportingPatterns:       ["decision_bottleneck", "approval_delay"],
      historicalOccurrences:    73,
      recommendationConfidence: 0.72,
      learningConfidence:       0.65,
      historicalEffectiveness:  0.76,
    },
  ],
  risk_accumulation: [
    {
      actionType:               "review_risk",
      basePriority:             "medium",
      titleTemplate:            () => "Review accumulated risks to prevent governance breakdown",
      descriptionTemplate:      (ctx) => `Multiple risks are accumulating without resolution (${ctx.signalTitle}). Conduct a formal risk review to assess collective exposure.`,
      supportingPatterns:       ["risk_accumulation", "delivery_drift"],
      historicalOccurrences:    66,
      recommendationConfidence: 0.68,
      learningConfidence:       0.62,
      historicalEffectiveness:  0.74,
    },
  ],
  delivery_drift: [
    {
      actionType:               "review_decision",
      basePriority:             "medium",
      titleTemplate:            () => "Review decisions contributing to delivery drift",
      descriptionTemplate:      (ctx) => `Delivery drift has been detected (${ctx.signalTitle}). Review pending decisions that may be contributing to schedule divergence.`,
      supportingPatterns:       ["delivery_drift", "decision_bottleneck", "approval_delay"],
      historicalOccurrences:    91,
      recommendationConfidence: 0.65,
      learningConfidence:       0.60,
      historicalEffectiveness:  0.72,
    },
  ],
};

export function generateActionsForSignalType(
  ctx: SignalContext
): ActionCandidate[] {
  const rules = SIGNAL_RULES[ctx.signalType];
  if (!rules || rules.length === 0) return [];

  return rules.map((rule) => {
    const priorityResult = calculateActionPriority({
      signalSeverity: ctx.signalSeverity,
      signalType:     ctx.signalType,
      confidenceScore: ctx.confidenceScore,
      durationDays:    ctx.durationDays,
    });

    const confidenceResult = calculateActionConfidence({
      signalConfidence:        ctx.confidenceScore,
      recommendationConfidence: rule.recommendationConfidence,
      learningConfidence:       rule.learningConfidence,
      historicalEffectiveness:  rule.historicalEffectiveness,
    });

    const priority = priorityResult.priority;
    const dueDate  = calculateRecommendedDueDate(priority);
    const ownerType = getRecommendedOwnerTypeForAction(rule.actionType);

    const justResult = generateActionJustification({
      actionType:            rule.actionType,
      signalType:            ctx.signalType,
      signalTitle:           ctx.signalTitle,
      supportingPatterns:    rule.supportingPatterns,
      historicalOccurrences: rule.historicalOccurrences,
      confidenceScore:       confidenceResult.score,
    });

    return {
      actionType:           rule.actionType,
      actionPriority:       priority,
      title:                rule.titleTemplate(ctx),
      description:          rule.descriptionTemplate(ctx),
      recommendedOwnerType: ownerType,
      justification:        justResult.justification,
      confidenceScore:      confidenceResult.score,
      recommendedDueDate:   dueDate,
    };
  });
}
