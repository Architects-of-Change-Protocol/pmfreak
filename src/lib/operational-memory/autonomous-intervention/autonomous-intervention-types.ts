import type { OperationalMemoryScope } from "../runtime-memory-types";
import type { CrossDomain } from "../cross-domain-correlation/cross-domain-correlation-types";

export type InterventionExecutionMode = "recommend_only"|"draft_for_human"|"require_approval"|"blocked_by_governance";
export type InterventionUrgency = "monitor"|"next_cycle"|"urgent"|"immediate";
export type InterventionCandidateType = "stakeholder_followup"|"executive_escalation"|"procurement_escalation"|"governance_decision_request"|"technical_recovery_session"|"scope_clarification"|"timeline_rebaseline"|"resource_reallocation"|"risk_acceptance_review"|"dependency_owner_assignment"|"milestone_recovery_plan"|"vendor_pressure_action"|"approval_chain_unblock"|"blocker_resolution_workshop";
export type InterventionSafetyClassification = "safe_recommendation"|"requires_human_approval"|"requires_executive_approval"|"blocked_by_policy"|"insufficient_evidence";
export type InterventionDomain = CrossDomain|"delivery"|"overall";

export type AutonomousInterventionRequest = { scope: OperationalMemoryScope; limit?: number; now?: string };
export type InterventionTarget = { domain: InterventionDomain; stakeholderRole?: string; targetReference?: string; scopeEvidence: string[] };
export type InterventionExpectedImpact = { expectedPressureReduction: number; expectedRecoveryProbabilityIncrease: number; expectedSurvivabilityImprovement: number; expectedTimelinePressureReduction: number; expectedEscalationReduction: number; expectedGovernanceClarityImprovement: number; confidence: number; uncertainty: string[] };
export type InterventionSafetyProfile = { classification: InterventionSafetyClassification; executionMode: InterventionExecutionMode; reasons: string[]; blockedActions: string[]; governanceRequirements: string[] };
export type InterventionGovernanceOutcome = { allowed: boolean; classification: InterventionSafetyClassification; rationale: string[]; requiredApprovals: string[] };
export type InterventionGovernanceDecision = InterventionGovernanceOutcome;
export type InterventionCandidate = { interventionId: string; type: InterventionCandidateType; target: InterventionTarget; evidence: string[]; urgency: InterventionUrgency; confidence: number; uncertainty: string[]; riskReduced: string[]; expectedImpact: InterventionExpectedImpact; safety: InterventionSafetyProfile; governanceDecision: InterventionGovernanceDecision; fallbackHint: string };
export type InterventionStep = { stepId: string; candidateId: string; type: InterventionCandidateType; rationale: string; dependencyStepIds: string[]; urgency: InterventionUrgency; expectedOutcome: string };
export type InterventionSequence = { orderedSteps: InterventionStep[]; sequencingRationale: string[] };
export type InterventionPlan = { topRecommendationId?: string; candidates: InterventionCandidate[]; sequence: InterventionSequence };
export type InterventionEscalationPath = { pathType: "operational"|"governance"|"commercial"|"procurement"|"executive"|"technical"; triggerCondition: string; targetRole: string; evidenceRequired: string[]; expectedImpact: string; fallbackIfIgnored: string; recommendedTiming: InterventionUrgency };
export type InterventionRecoveryPath = { scenario: "timeline_collapse"|"procurement_blockage"|"stakeholder_silence"|"governance_ambiguity"|"technical_blocker"|"resource_bottleneck"|"intervention_exhaustion"; steps: string[]; sequence: string[]; expectedEffect: string; dependencyAssumptions: string[]; riskIfNotExecuted: string };
export type InterventionFeedbackSignal = { event: "intervention_proposed"|"intervention_accepted"|"intervention_rejected"|"intervention_executed_manually"|"intervention_successful"|"intervention_failed"|"intervention_partially_effective"; interventionId: string; scope: OperationalMemoryScope; notes?: string; observedImpact?: number; createdAt: string };
export type InterventionDiagnostic = { interventionId: string; whyRecommended: string; whyUrgent: string; whySequenced: string; evidenceSummary: string; mitigatedRisk: string; governanceGate: InterventionSafetyClassification; uncertaintyRemaining: string; ifFailsNext: string };
export type InterventionNarrative = { interventionId: string; narrative: string; confidence: number; evidence: string[] };
export type AutonomousInterventionResult = { plan: InterventionPlan; escalationPaths: InterventionEscalationPath[]; recoveryPaths: InterventionRecoveryPath[]; diagnostics: InterventionDiagnostic[]; narratives: InterventionNarrative[]; feedbackHooks: Array<InterventionFeedbackSignal["event"]>; tenantIsolationPreserved: boolean; autonomousExecutionBlocked: true };
export type AutonomousInterventionContext = { request: AutonomousInterventionRequest; nowMs: number; evidence: string[]; criticalPathCollapseRisk: number; recoveryProbability: number; milestoneSurvivability: number; stakeholderSilenceLevel: number; unresolvedPressure: number; bottleneckSeverity: number; systemicInstability: number; governanceErosion: number };
