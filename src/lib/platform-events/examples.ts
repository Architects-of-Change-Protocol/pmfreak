// ─────────────────────────────────────────────────────────────────────────────
// Governance Event Layer — Usage examples / seed fixtures
//
// These are illustrative examples using fake IDs. Do not run against production.
// They show how to record each major event type using the domain wrappers.
// ─────────────────────────────────────────────────────────────────────────────

import {
  recordAiRecommendationCreatedEvent,
  recordDependencyBlockedEvent,
  recordHumanDecisionEvent,
  recordOutcomeRecordedEvent,
  recordProjectCreatedEvent,
  recordRiskCreatedEvent,
} from "./domain-events";

// Fake fixture IDs — replace with real IDs in production
const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";
const PROJECT_ID = "00000000-0000-0000-0000-000000000002";
const ACTOR_ID = "00000000-0000-0000-0000-000000000003";
const RISK_ID = "00000000-0000-0000-0000-000000000010";
const DEPENDENCY_ID = "00000000-0000-0000-0000-000000000020";
const RECOMMENDATION_ID = "00000000-0000-0000-0000-000000000030";
const DECISION_ID = "00000000-0000-0000-0000-000000000040";
const OUTCOME_ID = "00000000-0000-0000-0000-000000000050";

export async function runExampleEvents(): Promise<void> {
  // 1. PROJECT_CREATED — when a new project is created
  const projectResult = await recordProjectCreatedEvent({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    actorId: ACTOR_ID,
    projectStatus: "active",
    rawReferenceId: PROJECT_ID,
  });
  console.log("PROJECT_CREATED:", projectResult.ok ? "ok" : projectResult.error);

  // 2. RISK_CREATED — when a risk is logged
  const riskResult = await recordRiskCreatedEvent({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    actorId: ACTOR_ID,
    riskId: RISK_ID,
    riskCategory: "external_vendor_delay",
    severity: "high",
    probability: "medium",
    impact: "high",
  });
  console.log("RISK_CREATED:", riskResult.ok ? "ok" : riskResult.error);

  // 3. DEPENDENCY_BLOCKED — when a dependency becomes a blocker
  const depResult = await recordDependencyBlockedEvent({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    actorId: ACTOR_ID,
    dependencyId: DEPENDENCY_ID,
    dependencyType: "vendor_delivery",
    blockerCategory: "payment_dependency",
    severity: "high",
  });
  console.log("DEPENDENCY_BLOCKED:", depResult.ok ? "ok" : depResult.error);

  // 4. AI_RECOMMENDATION_CREATED — when the AI proposes an action
  const recResult = await recordAiRecommendationCreatedEvent({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    actorId: null, // system actor — no human
    recommendationId: RECOMMENDATION_ID,
    recommendationType: "risk_escalation",
    confidenceBucket: "high",
    affectedArea: "delivery",
    proposedActionType: "escalate",
    causationId: riskResult.ok ? riskResult.event.id : null,
  });
  console.log("AI_RECOMMENDATION_CREATED:", recResult.ok ? "ok" : recResult.error);

  // 5. HUMAN_DECISION_RECORDED — when a PM accepts/rejects the recommendation
  const decisionResult = await recordHumanDecisionEvent({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    actorId: ACTOR_ID,
    decisionId: DECISION_ID,
    relatedRecommendationId: RECOMMENDATION_ID,
    decisionType: "accepted",
    decisionLatencyBucket: "same_day",
    causationId: recResult.ok ? recResult.event.id : null,
  });
  console.log("HUMAN_DECISION_RECORDED:", decisionResult.ok ? "ok" : decisionResult.error);

  // 6. OUTCOME_RECORDED — when project outcome is documented
  const outcomeResult = await recordOutcomeRecordedEvent({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    actorId: ACTOR_ID,
    outcomeId: OUTCOME_ID,
    successStatus: "partial_success",
    scheduleVarianceBucket: "15_30_days",
    budgetVarianceBucket: "0_10_percent",
  });
  console.log("OUTCOME_RECORDED:", outcomeResult.ok ? "ok" : outcomeResult.error);
}
