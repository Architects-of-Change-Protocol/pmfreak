import { createHash, randomUUID } from "node:crypto";

import type { RaidCategory } from "@/lib/raid";

export type RecommendedActionType =
  | "schedule_meeting"
  | "stakeholder_alignment"
  | "request_approval"
  | "create_mitigation_plan"
  | "create_contingency_plan"
  | "clarify_requirement"
  | "escalate_issue"
  | "confirm_dependency"
  | "assign_owner"
  | "review_assumption"
  | "validate_scope"
  | "follow_up"
  | "other";

export type RecommendedActionStatus =
  | "proposed"
  | "accepted"
  | "rejected"
  | "deferred"
  | "converted_to_task";

export type ImpactLevel = "low" | "medium" | "high" | "critical";

export type GeneratedRecommendedAction = {
  id: string;
  workspaceId: string;
  projectId: string;
  raidItemId: string;
  title: string;
  description: string;
  recommendedActionType: RecommendedActionType;
  status: RecommendedActionStatus;
  confidenceScore: number;
  impactLevel: ImpactLevel;
  rationale: Record<string, unknown>;
  recommendedOwner: string | null;
  recommendedDueWindow: string | null;
  evidenceSummary: Record<string, unknown>;
  sourceSignalId: string | null;
  fingerprint: string;
};

type RaidItemInput = {
  id: string;
  workspaceId: string;
  projectId: string;
  category: RaidCategory;
  title: string;
  description: string;
  confidenceScore: number;
  owner: string | null;
  sourceSignalId: string | null;
};

type ActionSpec = {
  actionType: RecommendedActionType;
  title: string;
  description: string;
  impactLevel: ImpactLevel;
  confidenceScore: number;
  rationale: Record<string, unknown>;
  recommendedOwner: string | null;
  recommendedDueWindow: string | null;
};

const lower = (s: string) => s.toLowerCase();

const hasKeyword = (text: string, ...keywords: string[]) =>
  keywords.some((kw) => lower(text).includes(kw));

function actionFingerprint(workspaceId: string, projectId: string, raidItemId: string, actionType: RecommendedActionType): string {
  return createHash("sha256")
    .update(`${workspaceId}:${projectId}:${raidItemId}:${actionType}`)
    .digest("hex");
}

function buildAction(
  item: RaidItemInput,
  spec: ActionSpec,
): GeneratedRecommendedAction {
  const fingerprint = actionFingerprint(item.workspaceId, item.projectId, item.id, spec.actionType);
  return {
    id: randomUUID(),
    workspaceId: item.workspaceId,
    projectId: item.projectId,
    raidItemId: item.id,
    title: spec.title,
    description: spec.description,
    recommendedActionType: spec.actionType,
    status: "proposed",
    confidenceScore: Math.max(0, Math.min(100, spec.confidenceScore)),
    impactLevel: spec.impactLevel,
    rationale: spec.rationale,
    recommendedOwner: spec.recommendedOwner ?? item.owner,
    recommendedDueWindow: spec.recommendedDueWindow,
    evidenceSummary: {
      raidItemId: item.id,
      raidCategory: item.category,
      raidTitle: item.title,
      raidConfidenceScore: item.confidenceScore,
      discoveryOrigin: "project_discovery",
      sourceSignalId: item.sourceSignalId,
    },
    sourceSignalId: item.sourceSignalId,
    fingerprint,
  };
}

function generateRiskActions(item: RaidItemInput): ActionSpec[] {
  const text = `${item.title} ${item.description}`;
  const specs: ActionSpec[] = [];
  const baseConf = item.confidenceScore;

  const isApprovalRisk = hasKeyword(text, "approval", "approv", "sign-off", "sign off", "authorize", "autoriza", "aprobación");
  const isVendorRisk = hasKeyword(text, "vendor", "supplier", "proveedor", "third party", "external");
  const isScheduleRisk = hasKeyword(text, "schedule", "delay", "deadline", "cronograma", "retraso", "fecha");
  const isGovernanceRisk = hasKeyword(text, "governance", "compliance", "regulatory", "regulatori");

  if (isApprovalRisk) {
    specs.push({
      actionType: "request_approval",
      title: `Request approval: ${item.title.slice(0, 60)}`,
      description: `A risk has been identified related to approval dependencies. Initiate a formal approval request to unblock progress and prevent schedule impact.`,
      impactLevel: "high",
      confidenceScore: Math.min(100, baseConf + 5),
      rationale: {
        trigger: "approval_dependency_detected",
        raidCategory: item.category,
        riskText: item.title,
      },
      recommendedOwner: item.owner,
      recommendedDueWindow: "within 3 business days",
    });
    specs.push({
      actionType: "schedule_meeting",
      title: `Schedule approval alignment session`,
      description: `Coordinate a focused meeting with the approver(s) to walk through requirements, address blockers, and secure sign-off on the approval dependency.`,
      impactLevel: "high",
      confidenceScore: Math.min(100, baseConf + 3),
      rationale: {
        trigger: "approval_dependency_requires_stakeholder_coordination",
        raidCategory: item.category,
      },
      recommendedOwner: item.owner,
      recommendedDueWindow: "within 5 business days",
    });
  } else if (isGovernanceRisk) {
    specs.push({
      actionType: "stakeholder_alignment",
      title: `Align stakeholders on governance risk`,
      description: `Governance or compliance risk detected. Convene a stakeholder alignment session to clarify obligations and agree on mitigation steps.`,
      impactLevel: "high",
      confidenceScore: Math.min(100, baseConf + 2),
      rationale: { trigger: "governance_risk_detected", raidCategory: item.category },
      recommendedOwner: item.owner,
      recommendedDueWindow: "within 1 week",
    });
  } else if (isVendorRisk || isScheduleRisk) {
    specs.push({
      actionType: "create_mitigation_plan",
      title: `Create mitigation plan: ${item.title.slice(0, 55)}`,
      description: `A risk has been flagged. Develop a concrete mitigation plan with assigned owners, contingency steps, and a review checkpoint.`,
      impactLevel: "medium",
      confidenceScore: baseConf,
      rationale: { trigger: "risk_requires_mitigation", raidCategory: item.category, riskType: isVendorRisk ? "vendor" : "schedule" },
      recommendedOwner: item.owner,
      recommendedDueWindow: "within 1 week",
    });
  } else {
    specs.push({
      actionType: "create_mitigation_plan",
      title: `Create mitigation plan: ${item.title.slice(0, 55)}`,
      description: `Risk identified. Define a mitigation approach with clear owners, actions, and timelines to reduce likelihood or impact.`,
      impactLevel: "medium",
      confidenceScore: baseConf,
      rationale: { trigger: "risk_requires_mitigation", raidCategory: item.category },
      recommendedOwner: item.owner,
      recommendedDueWindow: "within 1 week",
    });
  }

  specs.push({
    actionType: "follow_up",
    title: `Follow up on risk: ${item.title.slice(0, 60)}`,
    description: `Schedule a follow-up checkpoint to verify mitigation progress and confirm the risk remains monitored.`,
    impactLevel: "low",
    confidenceScore: Math.max(30, baseConf - 10),
    rationale: { trigger: "risk_monitoring_required", raidCategory: item.category },
    recommendedOwner: item.owner,
    recommendedDueWindow: "within 2 weeks",
  });

  return specs;
}

function generateDependencyActions(item: RaidItemInput): ActionSpec[] {
  const text = `${item.title} ${item.description}`;
  const baseConf = item.confidenceScore;
  const hasNoOwner = !item.owner;

  const specs: ActionSpec[] = [
    {
      actionType: "confirm_dependency",
      title: `Confirm dependency: ${item.title.slice(0, 60)}`,
      description: `Verify status, timeline, and owner of this dependency. Confirm delivery commitment and identify any blockers.`,
      impactLevel: "high",
      confidenceScore: Math.min(100, baseConf + 5),
      rationale: { trigger: "dependency_requires_confirmation", raidCategory: item.category },
      recommendedOwner: item.owner,
      recommendedDueWindow: "within 3 business days",
    },
  ];

  if (hasNoOwner || hasKeyword(text, "unassigned", "no owner", "unknown owner", "tbd", "por asignar")) {
    specs.push({
      actionType: "assign_owner",
      title: `Assign owner to dependency`,
      description: `This dependency lacks a confirmed owner. Assign a responsible party to ensure accountability and progress tracking.`,
      impactLevel: "medium",
      confidenceScore: Math.min(100, baseConf + 3),
      rationale: { trigger: "dependency_missing_owner", raidCategory: item.category },
      recommendedOwner: null,
      recommendedDueWindow: "within 2 business days",
    });
  }

  specs.push({
    actionType: "follow_up",
    title: `Follow up on dependency: ${item.title.slice(0, 55)}`,
    description: `Schedule periodic follow-up to track dependency progress against committed dates and surface any emerging risks.`,
    impactLevel: "low",
    confidenceScore: Math.max(30, baseConf - 10),
    rationale: { trigger: "dependency_monitoring_required", raidCategory: item.category },
    recommendedOwner: item.owner,
    recommendedDueWindow: "within 1 week",
  });

  return specs;
}

function generateAssumptionActions(item: RaidItemInput): ActionSpec[] {
  const baseConf = item.confidenceScore;
  return [
    {
      actionType: "review_assumption",
      title: `Review assumption: ${item.title.slice(0, 60)}`,
      description: `Evaluate whether this assumption still holds. Challenge the premise with current data and document the validation outcome.`,
      impactLevel: "medium",
      confidenceScore: Math.min(100, baseConf + 3),
      rationale: { trigger: "assumption_requires_validation", raidCategory: item.category },
      recommendedOwner: item.owner,
      recommendedDueWindow: "within 1 week",
    },
    {
      actionType: "validate_scope",
      title: `Validate scope against assumption`,
      description: `Cross-check project scope with this assumption to identify any mismatch. Update scope documentation if the assumption proves invalid.`,
      impactLevel: "medium",
      confidenceScore: baseConf,
      rationale: { trigger: "assumption_may_impact_scope", raidCategory: item.category },
      recommendedOwner: item.owner,
      recommendedDueWindow: "within 2 weeks",
    },
  ];
}

function generateIssueActions(item: RaidItemInput): ActionSpec[] {
  const text = `${item.title} ${item.description}`;
  const baseConf = item.confidenceScore;
  const isBlocker = hasKeyword(text, "block", "blocker", "blocked", "bloqueo", "bloqueado", "critical", "crítico");
  const isEscalation = hasKeyword(text, "escalat", "unresolved", "sin resolver", "outstanding", "stalled");

  const specs: ActionSpec[] = [];

  if (isBlocker || isEscalation) {
    specs.push({
      actionType: "escalate_issue",
      title: `Escalate issue: ${item.title.slice(0, 60)}`,
      description: `This issue is blocking progress or has gone unresolved. Escalate to the appropriate decision-maker to unblock the team.`,
      impactLevel: "critical",
      confidenceScore: Math.min(100, baseConf + 8),
      rationale: { trigger: "blocker_or_unresolved_issue", raidCategory: item.category },
      recommendedOwner: item.owner,
      recommendedDueWindow: "immediate",
    });
  }

  specs.push({
    actionType: "create_mitigation_plan",
    title: `Create issue resolution plan: ${item.title.slice(0, 50)}`,
    description: `Document a structured resolution plan for this issue including root cause, assigned owner, steps to resolve, and target date.`,
    impactLevel: isBlocker ? "critical" : "high",
    confidenceScore: Math.min(100, baseConf + 4),
    rationale: { trigger: "issue_requires_resolution_plan", raidCategory: item.category },
    recommendedOwner: item.owner,
    recommendedDueWindow: "within 3 business days",
  });

  if (hasKeyword(text, "unknown", "unclear", "desconocido", "gap", "undefined")) {
    specs.push({
      actionType: "clarify_requirement",
      title: `Clarify requirements to resolve issue`,
      description: `This issue involves unclear requirements or an undefined scope element. Engage the relevant stakeholders to obtain clear specifications.`,
      impactLevel: "medium",
      confidenceScore: baseConf,
      rationale: { trigger: "issue_linked_to_unclear_requirements", raidCategory: item.category },
      recommendedOwner: item.owner,
      recommendedDueWindow: "within 1 week",
    });
  }

  return specs;
}

function generateUnknownActions(item: RaidItemInput): ActionSpec[] {
  const baseConf = item.confidenceScore;
  return [
    {
      actionType: "clarify_requirement",
      title: `Clarify unknown: ${item.title.slice(0, 60)}`,
      description: `An unresolved gap has been identified. Engage stakeholders to obtain the information needed to remove this unknown from the risk register.`,
      impactLevel: "medium",
      confidenceScore: Math.min(100, baseConf + 4),
      rationale: { trigger: "unknown_requires_clarification", raidCategory: item.category },
      recommendedOwner: item.owner,
      recommendedDueWindow: "within 1 week",
    },
    {
      actionType: "stakeholder_alignment",
      title: `Align stakeholders to resolve gap`,
      description: `Coordinate with relevant stakeholders to surface information needed to resolve this unknown and prevent downstream impact.`,
      impactLevel: "medium",
      confidenceScore: baseConf,
      rationale: { trigger: "unknown_requires_stakeholder_input", raidCategory: item.category },
      recommendedOwner: item.owner,
      recommendedDueWindow: "within 1 week",
    },
  ];
}

export function generateRecommendedActions(item: RaidItemInput): GeneratedRecommendedAction[] {
  let specs: ActionSpec[];

  switch (item.category) {
    case "risk":
      specs = generateRiskActions(item);
      break;
    case "dependency":
      specs = generateDependencyActions(item);
      break;
    case "assumption":
      specs = generateAssumptionActions(item);
      break;
    case "issue":
      if (item.confidenceScore < 40) {
        specs = generateUnknownActions(item);
      } else {
        specs = generateIssueActions(item);
      }
      break;
    default:
      specs = generateUnknownActions(item);
  }

  return specs.map((spec) => buildAction(item, spec));
}
