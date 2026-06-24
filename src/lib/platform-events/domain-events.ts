// ─────────────────────────────────────────────────────────────────────────────
// Domain-specific event wrappers
//
// Each wrapper calls createPlatformEvent with a typed, minimal payload.
// Payloads capture structured facts — not names, descriptions, or raw content.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "./create-event";
import type { PlatformEventResult } from "./types";

type BaseEventInput = {
  workspaceId: string;
  projectId?: string | null;
  actorId?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
};

// ─── Project events ───────────────────────────────────────────────────────────

export async function recordProjectCreatedEvent(
  base: BaseEventInput & {
    projectId: string;
    projectStatus: string;
    rawReferenceId?: string;
  }
): Promise<PlatformEventResult> {
  return createPlatformEvent({
    ...base,
    eventType: "PROJECT_CREATED",
    eventCategory: "project",
    source: "user_action",
    actorType: "user",
    learningEligible: true,
    rawReferenceTable: "projects",
    rawReferenceId: base.rawReferenceId ?? base.projectId,
    eventPayload: {
      project_id: base.projectId,
      project_status: base.projectStatus,
    },
  });
}

export async function recordProjectStatusChangedEvent(
  base: BaseEventInput & {
    projectId: string;
    previousStatus: string;
    newStatus: string;
  }
): Promise<PlatformEventResult> {
  return createPlatformEvent({
    ...base,
    eventType: "PROJECT_STATUS_CHANGED",
    eventCategory: "project",
    source: "user_action",
    actorType: "user",
    learningEligible: true,
    rawReferenceTable: "projects",
    rawReferenceId: base.projectId,
    eventPayload: {
      project_id: base.projectId,
      previous_status: base.previousStatus,
      new_status: base.newStatus,
    },
  });
}

// ─── Risk events ──────────────────────────────────────────────────────────────

export async function recordRiskCreatedEvent(
  base: BaseEventInput & {
    riskId: string;
    riskCategory: string;
    severity: string;
    probability: string;
    impact: string;
  }
): Promise<PlatformEventResult> {
  return createPlatformEvent({
    ...base,
    eventType: "RISK_CREATED",
    eventCategory: "risk",
    source: "user_action",
    actorType: "user",
    learningEligible: true,
    rawReferenceTable: "risk_issue_records",
    rawReferenceId: base.riskId,
    eventPayload: {
      risk_id: base.riskId,
      risk_category: base.riskCategory,
      severity: base.severity,
      probability: base.probability,
      impact: base.impact,
    },
  });
}

export async function recordRiskEscalatedEvent(
  base: BaseEventInput & {
    riskId: string;
    riskCategory: string;
    previousSeverity: string;
    newSeverity: string;
    escalationReason?: string;
  }
): Promise<PlatformEventResult> {
  return createPlatformEvent({
    ...base,
    eventType: "RISK_ESCALATED",
    eventCategory: "risk",
    source: "user_action",
    actorType: "user",
    learningEligible: true,
    rawReferenceTable: "risk_issue_records",
    rawReferenceId: base.riskId,
    eventPayload: {
      risk_id: base.riskId,
      risk_category: base.riskCategory,
      previous_severity: base.previousSeverity,
      new_severity: base.newSeverity,
      escalation_reason_category: base.escalationReason ?? "unspecified",
    },
  });
}

// ─── Dependency events ────────────────────────────────────────────────────────

export async function recordDependencyBlockedEvent(
  base: BaseEventInput & {
    dependencyId: string;
    dependencyType: string;
    blockerCategory: string;
    severity: string;
  }
): Promise<PlatformEventResult> {
  return createPlatformEvent({
    ...base,
    eventType: "DEPENDENCY_BLOCKED",
    eventCategory: "dependency",
    source: "user_action",
    actorType: "user",
    learningEligible: true,
    rawReferenceTable: "execution_task_dependencies",
    rawReferenceId: base.dependencyId,
    eventPayload: {
      dependency_id: base.dependencyId,
      dependency_type: base.dependencyType,
      blocker_category: base.blockerCategory,
      severity: base.severity,
    },
  });
}

export async function recordDependencyResolvedEvent(
  base: BaseEventInput & {
    dependencyId: string;
    dependencyType: string;
    resolutionCategory: string;
  }
): Promise<PlatformEventResult> {
  return createPlatformEvent({
    ...base,
    eventType: "DEPENDENCY_RESOLVED",
    eventCategory: "dependency",
    source: "user_action",
    actorType: "user",
    learningEligible: true,
    rawReferenceTable: "execution_task_dependencies",
    rawReferenceId: base.dependencyId,
    eventPayload: {
      dependency_id: base.dependencyId,
      dependency_type: base.dependencyType,
      resolution_category: base.resolutionCategory,
    },
  });
}

// ─── Scope events ─────────────────────────────────────────────────────────────

export async function recordScopeChangeRequestedEvent(
  base: BaseEventInput & {
    changeRequestId: string;
    changeCategory: string;
    estimatedImpact: string;
  }
): Promise<PlatformEventResult> {
  return createPlatformEvent({
    ...base,
    eventType: "SCOPE_CHANGE_REQUESTED",
    eventCategory: "scope",
    source: "user_action",
    actorType: "user",
    learningEligible: true,
    eventPayload: {
      change_request_id: base.changeRequestId,
      change_category: base.changeCategory,
      estimated_impact: base.estimatedImpact,
    },
  });
}

// ─── AI Recommendation events ─────────────────────────────────────────────────

export async function recordAiRecommendationCreatedEvent(
  base: BaseEventInput & {
    recommendationId: string;
    recommendationType: string;
    confidenceBucket: string;
    affectedArea: string;
    proposedActionType: string;
  }
): Promise<PlatformEventResult> {
  return createPlatformEvent({
    ...base,
    eventType: "AI_RECOMMENDATION_CREATED",
    eventCategory: "recommendation",
    source: "ai_agent",
    actorType: "ai_agent",
    learningEligible: true,
    rawReferenceTable: "recommended_actions",
    rawReferenceId: base.recommendationId,
    eventPayload: {
      recommendation_id: base.recommendationId,
      recommendation_type: base.recommendationType,
      confidence_bucket: base.confidenceBucket,
      affected_area: base.affectedArea,
      proposed_action_type: base.proposedActionType,
    },
  });
}

export async function recordAiRecommendationResponseEvent(
  base: BaseEventInput & {
    recommendationId: string;
    response: "AI_RECOMMENDATION_ACCEPTED" | "AI_RECOMMENDATION_REJECTED" | "AI_RECOMMENDATION_IGNORED" | "AI_RECOMMENDATION_MODIFIED";
    decisionLatencyBucket?: string;
  }
): Promise<PlatformEventResult> {
  return createPlatformEvent({
    ...base,
    eventType: base.response,
    eventCategory: "recommendation",
    source: "user_action",
    actorType: "user",
    learningEligible: true,
    rawReferenceTable: "recommended_actions",
    rawReferenceId: base.recommendationId,
    eventPayload: {
      recommendation_id: base.recommendationId,
      decision_latency_bucket: base.decisionLatencyBucket ?? "unknown",
    },
  });
}

// ─── Human Decision events ────────────────────────────────────────────────────

export async function recordHumanDecisionEvent(
  base: BaseEventInput & {
    decisionId: string;
    relatedRecommendationId?: string | null;
    decisionType: string;
    decisionLatencyBucket: string;
  }
): Promise<PlatformEventResult> {
  return createPlatformEvent({
    ...base,
    eventType: "HUMAN_DECISION_RECORDED",
    eventCategory: "decision",
    source: "user_action",
    actorType: "user",
    learningEligible: true,
    rawReferenceTable: "operational_decision_records",
    rawReferenceId: base.decisionId,
    eventPayload: {
      decision_id: base.decisionId,
      related_recommendation_id: base.relatedRecommendationId ?? null,
      decision_type: base.decisionType,
      decision_latency_bucket: base.decisionLatencyBucket,
    },
  });
}

// ─── Outcome events ───────────────────────────────────────────────────────────

export async function recordOutcomeRecordedEvent(
  base: BaseEventInput & {
    outcomeId: string;
    successStatus: string;
    scheduleVarianceBucket: string;
    budgetVarianceBucket: string;
  }
): Promise<PlatformEventResult> {
  return createPlatformEvent({
    ...base,
    eventType: "OUTCOME_RECORDED",
    eventCategory: "outcome",
    source: "user_action",
    actorType: "user",
    learningEligible: true,
    eventPayload: {
      outcome_id: base.outcomeId,
      success_status: base.successStatus,
      schedule_variance_bucket: base.scheduleVarianceBucket,
      budget_variance_bucket: base.budgetVarianceBucket,
    },
  });
}

// ─── Governance events ────────────────────────────────────────────────────────

export async function recordGovernanceExceptionEvent(
  base: BaseEventInput & {
    governanceEventId: string;
    ruleKey: string;
    exceptionCategory: string;
  }
): Promise<PlatformEventResult> {
  return createPlatformEvent({
    ...base,
    eventType: "GOVERNANCE_EXCEPTION_RECORDED",
    eventCategory: "governance",
    source: "system",
    actorType: "system",
    learningEligible: false,
    rawReferenceTable: "governance_events",
    rawReferenceId: base.governanceEventId,
    eventPayload: {
      governance_event_id: base.governanceEventId,
      rule_key: base.ruleKey,
      exception_category: base.exceptionCategory,
    },
  });
}


// ─── PM Registry events ───────────────────────────────────────────────────────

export async function recordPMRegisteredEvent(
  base: BaseEventInput & {
    pmId: string;
    actorId: string;
  }
): Promise<PlatformEventResult> {
  return createPlatformEvent({
    ...base,
    eventType: "PROJECT_MANAGER_REGISTERED",
    eventCategory: "governance",
    source: "user_action",
    actorType: "user",
    actorId: base.actorId,
    learningEligible: true,
    rawReferenceTable: "project_managers",
    rawReferenceId: base.pmId,
    eventPayload: {
      pm_id: base.pmId,
      workspace_id: base.workspaceId,
      source: "pm_registry",
    },
  });
}

export async function recordPMUpdatedEvent(
  base: BaseEventInput & {
    pmId: string;
    actorId: string;
    previousStatus?: string;
    newStatus?: string;
  }
): Promise<PlatformEventResult> {
  return createPlatformEvent({
    ...base,
    eventType: "PROJECT_MANAGER_UPDATED",
    eventCategory: "governance",
    source: "user_action",
    actorType: "user",
    actorId: base.actorId,
    learningEligible: true,
    rawReferenceTable: "project_managers",
    rawReferenceId: base.pmId,
    eventPayload: {
      pm_id: base.pmId,
      workspace_id: base.workspaceId,
      previous_status: base.previousStatus ?? null,
      new_status: base.newStatus ?? null,
      source: "pm_registry",
    },
  });
}

export async function recordPMProfileUpdatedEvent(
  base: BaseEventInput & {
    pmId: string;
    actorId: string;
  }
): Promise<PlatformEventResult> {
  return createPlatformEvent({
    ...base,
    eventType: "PROJECT_MANAGER_PROFILE_UPDATED",
    eventCategory: "governance",
    source: "user_action",
    actorType: "user",
    actorId: base.actorId,
    learningEligible: true,
    rawReferenceTable: "pm_profiles",
    rawReferenceId: base.pmId,
    eventPayload: {
      pm_id: base.pmId,
      workspace_id: base.workspaceId,
      source: "pm_registry",
    },
  });
}

export async function recordPMAssignedEvent(
  base: BaseEventInput & {
    pmId: string;
    assignmentId: string;
    assignmentType: string;
    actorId: string;
  }
): Promise<PlatformEventResult> {
  return createPlatformEvent({
    ...base,
    eventType: "PROJECT_MANAGER_ASSIGNED",
    eventCategory: "governance",
    source: "user_action",
    actorType: "user",
    actorId: base.actorId,
    learningEligible: true,
    rawReferenceTable: "pm_assignments",
    rawReferenceId: base.assignmentId,
    eventPayload: {
      pm_id: base.pmId,
      project_id: base.projectId ?? null,
      assignment_id: base.assignmentId,
      assignment_type: base.assignmentType,
      workspace_id: base.workspaceId,
      source: "pm_registry",
    },
  });
}

export async function recordPMUnassignedEvent(
  base: BaseEventInput & {
    pmId: string;
    assignmentId: string;
    assignmentType: string;
    actorId: string;
  }
): Promise<PlatformEventResult> {
  return createPlatformEvent({
    ...base,
    eventType: "PROJECT_MANAGER_UNASSIGNED",
    eventCategory: "governance",
    source: "user_action",
    actorType: "user",
    actorId: base.actorId,
    learningEligible: true,
    rawReferenceTable: "pm_assignments",
    rawReferenceId: base.assignmentId,
    eventPayload: {
      pm_id: base.pmId,
      project_id: base.projectId ?? null,
      assignment_id: base.assignmentId,
      assignment_type: base.assignmentType,
      workspace_id: base.workspaceId,
      source: "pm_registry",
    },
  });
}

// ─── PM Performance events ────────────────────────────────────────────────────

export async function recordPMPerformanceSnapshotGeneratedEvent(
  base: BaseEventInput & {
    pmId: string;
    snapshotId: string;
    overallScore: number;
    performanceStatus: string;
    assignedProjectCount: number;
    capacityStatus?: string | null;
    actorId?: string | null;
  }
): Promise<PlatformEventResult> {
  return createPlatformEvent({
    ...base,
    eventType: "PM_PERFORMANCE_SNAPSHOT_GENERATED",
    eventCategory: "governance",
    source: base.actorId ? "user_action" : "system",
    actorType: base.actorId ? "user" : "system",
    actorId: base.actorId ?? null,
    rawReferenceTable: "pm_performance_snapshots",
    rawReferenceId: base.snapshotId,
    eventPayload: {
      pm_id:                  base.pmId,
      snapshot_id:            base.snapshotId,
      overall_score:          base.overallScore,
      performance_status:     base.performanceStatus,
      assigned_project_count: base.assignedProjectCount,
      capacity_status:        base.capacityStatus ?? null,
      workspace_id:           base.workspaceId,
      source:                 "pm_performance",
    },
  });
}

export async function recordWorkspacePMPerformanceSnapshotsGeneratedEvent(
  base: BaseEventInput & {
    generatedCount: number;
    totalPmCount: number;
    averageScore: number;
    actorId?: string | null;
  }
): Promise<PlatformEventResult> {
  return createPlatformEvent({
    ...base,
    eventType: "PM_WORKSPACE_PERFORMANCE_SNAPSHOTS_GENERATED",
    eventCategory: "governance",
    source: base.actorId ? "user_action" : "system",
    actorType: base.actorId ? "user" : "system",
    actorId: base.actorId ?? null,
    rawReferenceTable: "pm_performance_snapshots",
    rawReferenceId: null,
    eventPayload: {
      workspace_id:             base.workspaceId,
      actor_user_id:            base.actorId ?? null,
      generated_snapshot_count: base.generatedCount,
      total_pm_count:           base.totalPmCount,
      average_performance_score: base.averageScore,
      source:                   "pm_performance",
    },
  });
}
