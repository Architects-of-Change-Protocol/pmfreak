import type { TaskDraftPriority } from "@/lib/db/database-contract";

type RecommendedActionInput = {
  id: string;
  title: string;
  description: string;
  recommended_action_type: string;
  impact_level: string | null;
  confidence_score: number | null;
  recommended_owner: string | null;
  recommended_due_window: string | null;
  rationale: Record<string, unknown> | null;
  evidence_summary: Record<string, unknown> | null;
};

type RaidItemInput = {
  id: string;
  category: string;
  title: string;
  description: string;
  owner: string | null;
  due_date: string | null;
} | null;

export type GeneratedTaskDraft = {
  title: string;
  description: string;
  suggestedOwner: string | null;
  suggestedDueWindow: string | null;
  priority: TaskDraftPriority;
  acceptanceCriteria: string[];
  checklist: string[];
  sourcePayload: Record<string, unknown>;
  confidenceScore: number | null;
};

function mapPriority(impactLevel: string | null): TaskDraftPriority {
  switch (impactLevel) {
    case "critical": return "critical";
    case "high":     return "high";
    case "medium":   return "medium";
    case "low":      return "low";
    default:         return "medium";
  }
}

function cleanTitle(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 120);
}

function buildDescription(
  action: RecommendedActionInput,
  raidItem: RaidItemInput,
): string {
  const parts: string[] = [action.description];

  if (raidItem) {
    parts.push(`Source RAID (${raidItem.category}): ${raidItem.title}. ${raidItem.description}`);
  }

  const rationale = action.rationale;
  if (rationale && typeof rationale === "object" && !Array.isArray(rationale)) {
    const trigger = rationale["trigger"];
    if (typeof trigger === "string") {
      parts.push(`Rationale: ${trigger.replace(/_/g, " ")}.`);
    }
  }

  const evidence = action.evidence_summary;
  if (evidence && typeof evidence === "object" && !Array.isArray(evidence)) {
    const category = evidence["raidCategory"];
    const conf = evidence["raidConfidenceScore"];
    if (category || conf !== undefined) {
      parts.push(
        `Evidence: RAID category ${String(category ?? "unknown")}, confidence ${String(conf ?? "—")}%.`
      );
    }
  }

  return parts.filter(Boolean).join("\n\n");
}

const ACCEPTANCE_CRITERIA: Record<string, string[]> = {
  request_approval: [
    "Approval owner identified",
    "Approval request sent",
    "Approval response received or escalation path documented",
  ],
  schedule_meeting: [
    "Required stakeholders identified",
    "Meeting scheduled",
    "Decision or next steps captured",
  ],
  create_mitigation_plan: [
    "Mitigation owner assigned",
    "Mitigation steps documented",
    "Due date agreed",
    "Residual risk reviewed",
  ],
  create_contingency_plan: [
    "Contingency owner assigned",
    "Contingency trigger conditions documented",
    "Activation steps defined",
    "Residual risk reviewed",
  ],
  clarify_requirement: [
    "Requirement owner identified",
    "Clarification received",
    "Scope or acceptance impact documented",
  ],
  follow_up: [
    "Follow-up owner assigned",
    "Response requested",
    "Next action recorded",
  ],
  escalate_issue: [
    "Escalation owner identified",
    "Issue escalated to appropriate decision-maker",
    "Resolution timeline agreed or escalation path documented",
  ],
  confirm_dependency: [
    "Dependency owner confirmed",
    "Delivery timeline confirmed",
    "Blockers identified and documented",
  ],
  assign_owner: [
    "Owner identified and confirmed",
    "Owner briefed on responsibilities",
    "Accountability recorded",
  ],
  review_assumption: [
    "Assumption reviewed against current data",
    "Validity documented",
    "Impact on plan assessed if assumption fails",
  ],
  validate_scope: [
    "Scope reviewed against current requirements",
    "Gaps or mismatches documented",
    "Scope document updated if needed",
  ],
  stakeholder_alignment: [
    "Stakeholders identified",
    "Alignment session held or scheduled",
    "Agreement or divergence documented",
  ],
  other: [
    "Action owner assigned",
    "Action completed",
    "Outcome documented",
  ],
};

const CHECKLIST: Record<string, string[]> = {
  request_approval: [
    "Identify the approver and their availability",
    "Prepare approval request with supporting context",
    "Send request and confirm receipt",
    "Track response and follow up if no reply within 2 business days",
    "Document outcome and any conditions attached to approval",
  ],
  schedule_meeting: [
    "Identify required stakeholders",
    "Propose agenda with clear objectives",
    "Schedule meeting and send invites",
    "Run meeting and capture decisions",
    "Send follow-up with action items",
  ],
  create_mitigation_plan: [
    "Confirm mitigation owner",
    "Define mitigation steps with deadlines",
    "Identify contingency if mitigation fails",
    "Review residual risk",
    "Schedule checkpoint to assess progress",
  ],
  create_contingency_plan: [
    "Define trigger conditions for activation",
    "Assign contingency owner",
    "Document activation steps",
    "Communicate plan to relevant stakeholders",
    "Schedule review date",
  ],
  clarify_requirement: [
    "Identify requirement owner",
    "Draft clarification questions",
    "Obtain written clarification",
    "Update scope or acceptance criteria",
    "Communicate changes to affected team members",
  ],
  follow_up: [
    "Identify follow-up owner",
    "Send follow-up request with deadline",
    "Track response",
    "Record outcome and next steps",
    "Escalate if no response by deadline",
  ],
  escalate_issue: [
    "Document issue with supporting evidence",
    "Identify escalation owner",
    "Send escalation with clear ask and deadline",
    "Track acknowledgment",
    "Record resolution or escalation outcome",
  ],
  confirm_dependency: [
    "Identify dependency owner",
    "Request written confirmation of delivery timeline",
    "Identify risks to delivery",
    "Document confirmation and any conditions",
    "Schedule follow-up checkpoint",
  ],
  assign_owner: [
    "Identify candidate owner",
    "Confirm owner availability and capacity",
    "Brief owner on scope and expectations",
    "Record assignment",
    "Schedule first check-in",
  ],
  review_assumption: [
    "Review assumption against latest information",
    "Validate or invalidate with stakeholder input",
    "Document outcome",
    "Update project plan if assumption is invalid",
  ],
  validate_scope: [
    "Review current scope documentation",
    "Cross-check against requirements and assumptions",
    "Identify gaps or mismatches",
    "Document findings",
    "Update scope document if changes are required",
  ],
  stakeholder_alignment: [
    "Identify stakeholders with divergent views",
    "Schedule alignment session",
    "Present options and facilitate discussion",
    "Document agreed position",
    "Communicate outcome",
  ],
  other: [
    "Define action clearly",
    "Assign owner",
    "Set due date",
    "Track completion",
    "Document outcome",
  ],
};

export function generateTaskDraftFromRecommendedAction(input: {
  recommendedAction: RecommendedActionInput;
  raidItem?: RaidItemInput;
}): GeneratedTaskDraft {
  const { recommendedAction: action, raidItem = null } = input;

  const actionType = action.recommended_action_type || "other";
  const criteria = ACCEPTANCE_CRITERIA[actionType] ?? ACCEPTANCE_CRITERIA["other"]!;
  const steps = CHECKLIST[actionType] ?? CHECKLIST["other"]!;

  const suggestedOwner =
    action.recommended_owner ?? raidItem?.owner ?? null;

  const suggestedDueWindow =
    action.recommended_due_window ?? null;

  return {
    title: cleanTitle(action.title),
    description: buildDescription(action, raidItem),
    suggestedOwner,
    suggestedDueWindow,
    priority: mapPriority(action.impact_level),
    acceptanceCriteria: criteria,
    checklist: steps,
    sourcePayload: {
      recommendedActionId: action.id,
      recommendedActionType: actionType,
      impactLevel: action.impact_level,
      raidItemId: raidItem?.id ?? null,
      raidCategory: raidItem?.category ?? null,
      evidenceSummary: action.evidence_summary ?? null,
      rationale: action.rationale ?? null,
    },
    confidenceScore:
      action.confidence_score !== null && action.confidence_score !== undefined
        ? Number(action.confidence_score)
        : null,
  };
}
