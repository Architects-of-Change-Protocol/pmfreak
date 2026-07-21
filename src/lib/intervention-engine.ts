import { buildExecutionRiskSnapshot } from "@/lib/execution-risk";
import type { ProjectMemorySnapshot } from "@/lib/memory/organization-memory";
import { buildStakeholderRelationshipSnapshot } from "@/lib/stakeholder-intelligence";
import { detectCoordinationCollapseRisk, detectOrganizationalDrift, type CoordinationCollapseRisk } from "@/lib/cross-signal-reasoning";
import type { AdaptiveOperationalProfile } from "@/lib/adaptive-operational-intelligence";

export type InterventionSeverity = "none" | "watch" | "elevated" | "critical";
export type InterventionCategory = "delivery_recovery" | "stakeholder_alignment" | "execution_unblock" | "capacity_protection" | "escalation_governance";
export type EscalationTarget = "none" | "project_lead" | "delivery_manager" | "sponsor" | "executive_steering_committee" | "portfolio_office";

export type InterventionTrigger = {
  key:
    | "unresolved_blockers_increasing"
    | "no_recent_execution_updates"
    | "pressure_confidence_divergence"
    | "repeated_escalation_without_resolution"
    | "execution_instability_multi_signal"
    | "unstable_delivery_cadence"
    | "pm_overload_signal"
    | "organizational_silence_after_escalation"
    | "coordination_collapse_risk";
  active: boolean;
  score: number;
  reason: string;
};

export type DeliveryInstabilitySignal = {
  severity: InterventionSeverity;
  instabilityScore: number;
  unstableCadence: boolean;
  executionInstabilityAcrossSignals: boolean;
  unresolvedBlockersIncreasing: boolean;
  noRecentExecutionUpdates: boolean;
};

export type OperationalDriftSignal = {
  severity: InterventionSeverity;
  driftScore: number;
  organizationalDrift: boolean;
  repeatedEscalationWithoutResolution: boolean;
  organizationalSilenceAfterEscalation: boolean;
  pressureConfidenceDivergence: boolean;
};

export type InterventionRecommendation = {
  category: InterventionCategory;
  severity: InterventionSeverity;
  triggerKeys: InterventionTrigger["key"][];
  action: string;
  rationale: string;
};

export type EscalationRecommendation = {
  severity: InterventionSeverity;
  target: EscalationTarget;
  reason: string;
  requiredWithinHours: number;
};

export type InterventionSnapshot = {
  projectId: string | null;
  generatedAt: string;
  /** 'empty' when no execution memory exists yet — no interventions or escalations are inferred. */
  state: "empty" | "populated";
  interventionRequired: boolean;
  interventionUrgency: InterventionSeverity;
  escalationProbability: number;
  deliveryBreakdownRisk: number;
  organizationalDrift: number;
  recommendedInterventionType: InterventionCategory;
  escalationTarget: EscalationTarget;
  machineOutput: {
    intervention_required: boolean;
    escalation_probability: number;
    delivery_breakdown_risk: number;
    organizational_drift: number;
    recommended_intervention_type: InterventionCategory;
    escalation_target: EscalationTarget;
  };
  commentary: string[];
  deliveryInstability: DeliveryInstabilitySignal;
  operationalDriftSignal: OperationalDriftSignal;
  stakeholderBreakdown: boolean;
  executionDeadlock: boolean;
  triggers: InterventionTrigger[];
  interventions: InterventionRecommendation[];
  escalations: EscalationRecommendation[];
  coordinationCollapse: CoordinationCollapseRisk;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const toSeverity = (score: number): InterventionSeverity => (score >= 85 ? "critical" : score >= 65 ? "elevated" : score >= 40 ? "watch" : "none");

const daysSince = (dateValue: string | null): number => {
  if (!dateValue) return 14;
  const parsed = Date.parse(dateValue);
  if (Number.isNaN(parsed)) return 14;
  return Math.max(0, Math.floor((Date.now() - parsed) / 86_400_000));
};

export function detectDeliveryInstability(snapshot: ProjectMemorySnapshot | null): DeliveryInstabilitySignal {
  const blockers = snapshot?.project.blockers.length ?? 0;
  const unresolved = snapshot?.project.unresolvedIssues.length ?? 0;
  const commitments = snapshot?.project.commitments.length ?? 0;
  const risks = snapshot?.project.risks.length ?? 0;
  const daysSilent = daysSince(snapshot?.lastUpdatedAt ?? null);

  const unresolvedBlockersIncreasing = blockers + unresolved >= 5;
  const noRecentExecutionUpdates = daysSilent >= 7;
  const unstableCadence = commitments >= 4 && (blockers > 0 || unresolved > 0);
  const executionInstabilityAcrossSignals = risks >= 3 && unresolved >= 2;

  const instabilityScore = clamp(
    (unresolvedBlockersIncreasing ? 28 : 0) +
      (noRecentExecutionUpdates ? 24 : 0) +
      (unstableCadence ? 24 : 0) +
      (executionInstabilityAcrossSignals ? 24 : 0),
  );

  return {
    severity: toSeverity(instabilityScore),
    instabilityScore,
    unstableCadence,
    executionInstabilityAcrossSignals,
    unresolvedBlockersIncreasing,
    noRecentExecutionUpdates,
  };
}

export function detectOperationalDrift(snapshot: ProjectMemorySnapshot | null): OperationalDriftSignal {
  const stakeholderPressureEvents = snapshot?.stakeholders.reduce((sum, s) => sum + s.pressurePatterns.length, 0) ?? 0;
  const concerns = snapshot?.detectedConcerns.length ?? 0;
  const unresolvedDecisions = snapshot?.decisions.filter((item) => item.unresolvedConsequences.length > 0).length ?? 0;
  const organizationSilence = daysSince(snapshot?.lastUpdatedAt ?? null) >= 10;

  const pressureConfidenceDivergence = stakeholderPressureEvents >= 5 && (snapshot?.project.blockers.length ?? 0) >= 3;
  const repeatedEscalationWithoutResolution = stakeholderPressureEvents >= 7 && unresolvedDecisions >= 2;
  const organizationalSilenceAfterEscalation = organizationSilence && stakeholderPressureEvents >= 3;
  const organizationalDrift = concerns >= 4 || unresolvedDecisions >= 3 || organizationalSilenceAfterEscalation;

  const driftScore = clamp(
    (pressureConfidenceDivergence ? 30 : 0) +
      (repeatedEscalationWithoutResolution ? 30 : 0) +
      (organizationalSilenceAfterEscalation ? 20 : 0) +
      (organizationalDrift ? 20 : 0),
  );

  return {
    severity: toSeverity(driftScore),
    driftScore,
    organizationalDrift,
    repeatedEscalationWithoutResolution,
    organizationalSilenceAfterEscalation,
    pressureConfidenceDivergence,
  };
}

export function detectEscalationNeed(input: { deliveryInstability: DeliveryInstabilitySignal; operationalDriftSignal: OperationalDriftSignal; stakeholderBreakdown: boolean; executionDeadlock: boolean }): number {
  return clamp(
    input.deliveryInstability.instabilityScore * 0.35 +
      input.operationalDriftSignal.driftScore * 0.35 +
      (input.stakeholderBreakdown ? 18 : 0) +
      (input.executionDeadlock ? 12 : 0),
  );
}

export function detectStakeholderBreakdown(snapshot: ProjectMemorySnapshot | null): boolean {
  const highPressureStakeholders = snapshot?.stakeholders.filter((s) => s.influence === "high" && s.pressurePatterns.length >= 2).length ?? 0;
  const decisionDriversInConflict = snapshot?.stakeholders.filter((s) => (s.decisionAuthority === "driver" || s.decisionAuthority === "approver") && s.sentimentSignals.length >= 3).length ?? 0;
  return highPressureStakeholders >= 2 || decisionDriversInConflict >= 2;
}

export function detectExecutionDeadlock(snapshot: ProjectMemorySnapshot | null): boolean {
  const blockers = snapshot?.project.blockers.length ?? 0;
  const unresolvedIssues = snapshot?.project.unresolvedIssues.length ?? 0;
  const unresolvedDecisions = snapshot?.decisions.filter((decision) => decision.unresolvedConsequences.length > 0).length ?? 0;
  return blockers >= 3 && unresolvedIssues >= 3 && unresolvedDecisions >= 1;
}

export function generateInterventionRecommendations(
  triggers: InterventionTrigger[],
  snapshot?: ProjectMemorySnapshot | null,
  adaptiveProfile?: AdaptiveOperationalProfile | null,
): InterventionRecommendation[] {
  const active = new Set(triggers.filter((item) => item.active).map((item) => item.key));
  const recommendations: InterventionRecommendation[] = [];

  // Adaptive context: enrich rationale with recurrence and fatigue signals when available.
  const failureCycle = adaptiveProfile?.patterns.find((p) => p.type === "repeated_failure_cycle" && p.confidence >= 50);
  const interventionFatigue = adaptiveProfile?.patterns.find((p) => p.type === "intervention_fatigue" && p.confidence >= 50);
  const recoveryPattern = adaptiveProfile?.patterns.find((p) => p.type === "recovery_pattern" && p.confidence >= 45);

  // Pull actual operational entities for grounded action text
  const topBlocker = snapshot?.project.blockers[0];
  const blockerCount = (snapshot?.project.blockers.length ?? 0) + (snapshot?.project.unresolvedIssues.length ?? 0);
  const pressuredStakeholders = snapshot?.stakeholders
    .filter((s) => s.pressurePatterns.length > 0)
    .map((s) => s.name)
    .slice(0, 2) ?? [];
  const unresolvedDecisionCount = snapshot?.decisions.filter((d) => d.unresolvedConsequences.length > 0).length ?? 0;

  if (active.has("unresolved_blockers_increasing") || active.has("unstable_delivery_cadence")) {
    const blockerRef = topBlocker ? `"${topBlocker.slice(0, 60)}${topBlocker.length > 60 ? "…" : ""}"` : null;
    // When a recovery pattern is active, reduce urgency and recommend monitoring instead of escalation.
    const isImproving = recoveryPattern && !failureCycle;
    const recurrenceNote = failureCycle
      ? ` This blocker pattern has recurred ${failureCycle.recurrenceCount} time${failureCycle.recurrenceCount !== 1 ? "s" : ""} — root-cause action is needed, not another point-in-time intervention.`
      : "";
    recommendations.push({
      category: "execution_unblock",
      severity: isImproving ? "watch" : "elevated",
      triggerKeys: (["unresolved_blockers_increasing", "unstable_delivery_cadence"] as const).filter((key) => active.has(key)),
      action: isImproving
        ? "Monitor blocker resolution — recovery signals are active. Confirm ownership before escalating."
        : (blockerRef
            ? `Assign owner and deadline for oldest active blocker: ${blockerRef}.`
            : "Run a blocker-burn session — assign owner and deadline to each of the unresolved execution constraints."),
      rationale: `${blockerCount} unresolved item${blockerCount !== 1 ? "s" : ""} accumulating without owner accountability. Execution stability declining.${recurrenceNote}`,
    });
  }
  if (active.has("pressure_confidence_divergence") || active.has("repeated_escalation_without_resolution")) {
    const stakeholderRef = pressuredStakeholders.length > 0 ? ` (${pressuredStakeholders.join(", ")})` : "";
    const decisionRef = unresolvedDecisionCount > 0 ? ` ${unresolvedDecisionCount} unresolved decision${unresolvedDecisionCount !== 1 ? "s" : ""} pending.` : "";
    const fatigueNote = interventionFatigue
      ? ` This recommendation is escalated because the same escalation pattern has recurred without improvement — standard alignment checkpoints have not resolved the underlying pressure.`
      : "";
    recommendations.push({
      category: "stakeholder_alignment",
      severity: "critical",
      triggerKeys: (["pressure_confidence_divergence", "repeated_escalation_without_resolution"] as const).filter((key) => active.has(key)),
      action: interventionFatigue
        ? `Escalate to executive steering — standard alignment checkpoints are not resolving stakeholder pressure${stakeholderRef}. Structural intervention required.`
        : `Reset stakeholder expectations with a single alignment checkpoint — clarify tradeoffs, decision gates, and delivery confidence${stakeholderRef}.`,
      rationale: `Escalation pressure${stakeholderRef} exceeds delivery confidence.${decisionRef} Pattern indicates organizational misalignment.${fatigueNote}`,
    });
  }
  if (active.has("no_recent_execution_updates") || active.has("organizational_silence_after_escalation")) {
    const daysSilent = triggers.find((t) => t.key === "no_recent_execution_updates")?.active ? "7+" : "10+";
    const persistenceNote = failureCycle
      ? ` This pattern has persisted across ${failureCycle.recurrenceCount} operational records — silence following escalation is a recurring cycle, not a one-time gap.`
      : "";
    recommendations.push({
      category: "delivery_recovery",
      severity: "elevated",
      triggerKeys: (["no_recent_execution_updates", "organizational_silence_after_escalation"] as const).filter((key) => active.has(key)),
      action: "Re-establish operating cadence: enforce a deterministic update window with explicit owner accountability within 24h.",
      rationale: `${daysSilent} days without execution signal. Operational drift detected across delivery checkpoints.${persistenceNote}`,
    });
  }

  if (recommendations.length === 0) {
    const monitorNote = recoveryPattern
      ? " Recovery signals are active — this issue is improving. Continue monitoring."
      : "";
    recommendations.push({
      category: "capacity_protection",
      severity: "watch",
      triggerKeys: [],
      action: "Maintain current execution cadence and monitor intervention thresholds daily.",
      rationale: `No deterministic threshold breach currently requires intervention.${monitorNote}`,
    });
  }

  return recommendations;
}

export function generateEscalationRecommendations(input: { escalationProbability: number; stakeholderBreakdown: boolean; executionDeadlock: boolean; operationalDriftSignal: OperationalDriftSignal }): EscalationRecommendation[] {
  if (input.escalationProbability < 40) {
    return [{ severity: "none", target: "none", reason: "Escalation pathways are not required under current deterministic thresholds.", requiredWithinHours: 0 }];
  }

  const baseTarget: EscalationTarget = input.executionDeadlock
    ? "delivery_manager"
    : input.stakeholderBreakdown
      ? "sponsor"
      : input.operationalDriftSignal.repeatedEscalationWithoutResolution
        ? "executive_steering_committee"
        : "project_lead";

  const severity = toSeverity(input.escalationProbability);
  const requiredWithinHours = severity === "critical" ? 6 : severity === "elevated" ? 24 : 72;

  const escalationReason = input.executionDeadlock
    ? "Execution deadlock — blockers, unresolved issues, and pending decisions are converging."
    : input.stakeholderBreakdown
      ? "Stakeholder breakdown — high-influence decision-drivers in conflict or under sustained pressure."
      : input.operationalDriftSignal.repeatedEscalationWithoutResolution
        ? "Repeated escalation without organizational resolution — pattern indicates structural friction."
        : "Combined instability signals crossed escalation threshold.";

  return [{
    severity,
    target: input.operationalDriftSignal.organizationalSilenceAfterEscalation && severity === "critical" ? "portfolio_office" : baseTarget,
    reason: escalationReason,
    requiredWithinHours,
  }];
}

// Architectural runway: deterministic intervention snapshots intentionally preserve typed machine rails
// for autonomous escalation agents, AI-driven intervention orchestration, PM coaching systems,
// portfolio-wide intervention prioritization, organizational execution graphs, and AI execution governance.
export function buildInterventionSnapshot(projectId: string | null, snapshot: ProjectMemorySnapshot | null, adaptiveProfile?: AdaptiveOperationalProfile | null): InterventionSnapshot {
  if (!snapshot) {
    // No execution memory yet: return an explicit empty snapshot instead of
    // inferring silence/drift signals from the absence of data.
    const emptySignal = { severity: "none" as const, instabilityScore: 0, unstableCadence: false, executionInstabilityAcrossSignals: false, unresolvedBlockersIncreasing: false, noRecentExecutionUpdates: false };
    return {
      projectId,
      generatedAt: new Date().toISOString(),
      state: "empty",
      interventionRequired: false,
      interventionUrgency: "none",
      escalationProbability: 0,
      deliveryBreakdownRisk: 0,
      organizationalDrift: 0,
      recommendedInterventionType: "capacity_protection",
      escalationTarget: "none",
      machineOutput: {
        intervention_required: false,
        escalation_probability: 0,
        delivery_breakdown_risk: 0,
        organizational_drift: 0,
        recommended_intervention_type: "capacity_protection",
        escalation_target: "none",
      },
      commentary: [],
      deliveryInstability: emptySignal,
      operationalDriftSignal: { severity: "none", driftScore: 0, organizationalDrift: false, repeatedEscalationWithoutResolution: false, organizationalSilenceAfterEscalation: false, pressureConfidenceDivergence: false },
      stakeholderBreakdown: false,
      executionDeadlock: false,
      triggers: [],
      interventions: [],
      escalations: [],
      coordinationCollapse: detectCoordinationCollapseRisk({ daysSilent: 0, unresolvedDependencies: 0, repeatedEscalationWithoutResolution: false, blockerCount: 0, stalledDecisions: 0, executionDeadlock: false }),
    };
  }

  const executionRisk = buildExecutionRiskSnapshot(projectId, snapshot);
  const stakeholderIntel = buildStakeholderRelationshipSnapshot(projectId, snapshot);
  const deliveryInstability = detectDeliveryInstability(snapshot);
  const operationalDriftSignal = detectOperationalDrift(snapshot);
  const stakeholderBreakdown = detectStakeholderBreakdown(snapshot);
  const executionDeadlock = detectExecutionDeadlock(snapshot);

  // Pull entity references for grounded trigger reasons
  const blockerCount = (snapshot?.project.blockers.length ?? 0) + (snapshot?.project.unresolvedIssues.length ?? 0);
  const daysSilent = daysSince(snapshot?.lastUpdatedAt ?? null);
  const pressuredStakeholderNames = (snapshot?.stakeholders ?? [])
    .filter((s) => s.pressurePatterns.length > 0)
    .map((s) => s.name)
    .slice(0, 2)
    .join(", ");
  const commitmentCount = snapshot?.project.commitments.length ?? 0;
  const riskCount = snapshot?.project.risks.length ?? 0;
  const unresolvedDecisions = snapshot?.decisions.filter((d) => d.unresolvedConsequences.length > 0).length ?? 0;

  // Coordination collapse: convergence of breakdown signals that individually wouldn't alarm
  const coordinationCollapse = detectCoordinationCollapseRisk({
    daysSilent,
    unresolvedDependencies: snapshot?.project.dependencies.length ?? 0,
    repeatedEscalationWithoutResolution: operationalDriftSignal.repeatedEscalationWithoutResolution,
    blockerCount,
    stalledDecisions: unresolvedDecisions,
    executionDeadlock,
  });

  // Organizational drift: detect directional movement not just current state
  const stakeholderPressureEvents = snapshot?.stakeholders.reduce((sum, s) => sum + s.pressurePatterns.length, 0) ?? 0;
  const orgDrift = detectOrganizationalDrift({
    escalationFrequencyIncreasing: operationalDriftSignal.repeatedEscalationWithoutResolution,
    silenceDurationDays: daysSilent,
    repeatedEscalationWithoutResolution: operationalDriftSignal.repeatedEscalationWithoutResolution,
    coordinationBreakdownPresent: coordinationCollapse.level === "elevated" || coordinationCollapse.level === "critical",
    pmFatigue: clamp(commitmentCount * 8 + (snapshot?.project.blockers.length ?? 0) * 4),
    deliveryRisk: clamp((snapshot?.project.blockers.length ?? 0) * 15 + (snapshot?.project.risks.length ?? 0) * 10),
    stakeholderPressure: clamp(stakeholderPressureEvents * 10),
  });

  const triggers: InterventionTrigger[] = [
    {
      key: "unresolved_blockers_increasing",
      active: deliveryInstability.unresolvedBlockersIncreasing,
      // Score scales with actual blocker accumulation, not a flat 75
      score: deliveryInstability.unresolvedBlockersIncreasing ? clamp(45 + blockerCount * 6) : 15,
      reason: deliveryInstability.unresolvedBlockersIncreasing
        ? `${blockerCount} unresolved item${blockerCount !== 1 ? "s" : ""} accumulating without resolution.`
        : "Blocker load within acceptable threshold.",
    },
    {
      key: "no_recent_execution_updates",
      active: deliveryInstability.noRecentExecutionUpdates,
      score: deliveryInstability.noRecentExecutionUpdates ? clamp(40 + daysSilent * 4) : 10,
      reason: deliveryInstability.noRecentExecutionUpdates
        ? `No execution updates for ${daysSilent} day${daysSilent !== 1 ? "s" : ""}.`
        : "Execution cadence has recent signal continuity.",
    },
    {
      key: "pressure_confidence_divergence",
      active: operationalDriftSignal.pressureConfidenceDivergence,
      score: operationalDriftSignal.pressureConfidenceDivergence ? clamp(65 + blockerCount * 3) : 20,
      reason: operationalDriftSignal.pressureConfidenceDivergence
        ? `Stakeholder pressure rising${pressuredStakeholderNames ? ` (${pressuredStakeholderNames})` : ""} while delivery confidence drops.`
        : "Pressure and confidence signals remain aligned.",
    },
    {
      key: "repeated_escalation_without_resolution",
      active: operationalDriftSignal.repeatedEscalationWithoutResolution,
      score: operationalDriftSignal.repeatedEscalationWithoutResolution ? clamp(70 + unresolvedDecisions * 5) : 18,
      reason: operationalDriftSignal.repeatedEscalationWithoutResolution
        ? `Escalation pattern active with ${unresolvedDecisions} unresolved decision${unresolvedDecisions !== 1 ? "s" : ""}.`
        : "No repeated escalation pattern detected.",
    },
    {
      key: "execution_instability_multi_signal",
      active: deliveryInstability.executionInstabilityAcrossSignals,
      score: deliveryInstability.executionInstabilityAcrossSignals ? clamp(50 + riskCount * 5 + blockerCount * 3) : 16,
      reason: deliveryInstability.executionInstabilityAcrossSignals
        ? `${riskCount} risk${riskCount !== 1 ? "s" : ""} and ${blockerCount} unresolved item${blockerCount !== 1 ? "s" : ""} — multi-signal instability.`
        : "Execution signals are within single-domain thresholds.",
    },
    {
      key: "unstable_delivery_cadence",
      active: deliveryInstability.unstableCadence,
      score: deliveryInstability.unstableCadence ? clamp(40 + commitmentCount * 5) : 12,
      reason: deliveryInstability.unstableCadence
        ? `${commitmentCount} active commitment${commitmentCount !== 1 ? "s" : ""} with unresolved blockers degrading cadence.`
        : "Delivery cadence is stable relative to commitment load.",
    },
    {
      key: "pm_overload_signal",
      active: commitmentCount >= 6 && (snapshot?.project.blockers.length ?? 0) >= 3,
      score: commitmentCount >= 6 ? clamp(40 + commitmentCount * 4 + blockerCount * 3) : 22,
      reason: commitmentCount >= 6 && (snapshot?.project.blockers.length ?? 0) >= 3
        ? `PM managing ${commitmentCount} commitments with ${snapshot?.project.blockers.length} blockers — overload signal.`
        : "PM commitment and blocker load within acceptable range.",
    },
    {
      key: "organizational_silence_after_escalation",
      active: operationalDriftSignal.organizationalSilenceAfterEscalation,
      score: operationalDriftSignal.organizationalSilenceAfterEscalation ? clamp(60 + daysSilent * 3) : 14,
      reason: operationalDriftSignal.organizationalSilenceAfterEscalation
        ? `${daysSilent} days of silence following escalation — no organizational response recorded.`
        : "No organizational silence pattern after escalation.",
    },
    {
      key: "coordination_collapse_risk",
      active: coordinationCollapse.level === "elevated" || coordinationCollapse.level === "critical",
      score: coordinationCollapse.level === "critical" ? 85 : coordinationCollapse.level === "elevated" ? 65 : coordinationCollapse.level === "watch" ? 40 : 10,
      reason: coordinationCollapse.level !== "none"
        ? coordinationCollapse.description
        : "No coordination collapse patterns detected.",
    },
  ];

  const escalationProbability = detectEscalationNeed({ deliveryInstability, operationalDriftSignal, stakeholderBreakdown, executionDeadlock });
  const interventionUrgency = toSeverity(clamp((deliveryInstability.instabilityScore + operationalDriftSignal.driftScore + escalationProbability) / 3));
  const interventions = generateInterventionRecommendations(triggers, snapshot, adaptiveProfile);
  const escalations = generateEscalationRecommendations({ escalationProbability, stakeholderBreakdown, executionDeadlock, operationalDriftSignal });

  const interventionRequired = interventionUrgency === "elevated" || interventionUrgency === "critical";
  const recommendedInterventionType = interventions[0]?.category ?? "capacity_protection";
  const escalationTarget = escalations[0]?.target ?? "none";

  const deliveryBreakdownRisk = clamp((deliveryInstability.instabilityScore * 0.6) + (executionRisk.overallRisk === "critical" ? 35 : executionRisk.overallRisk === "high" ? 20 : executionRisk.overallRisk === "medium" ? 10 : 0));
  const organizationalDriftScore = clamp((operationalDriftSignal.driftScore * 0.7) + (stakeholderIntel.politicalRisk === "critical" ? 30 : stakeholderIntel.politicalRisk === "high" ? 20 : stakeholderIntel.politicalRisk === "moderate" ? 10 : 0));

  const commentary = [
    ...triggers.filter((t) => t.active).map((t) => t.reason),
    ...(orgDrift.driftDetected ? [`Organizational drift (${orgDrift.driftSeverity}): ${orgDrift.driftIndicators[0] ?? "directional deterioration detected"}.`] : []),
    ...(coordinationCollapse.level !== "none" ? [coordinationCollapse.description] : []),
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    state: "populated",
    interventionRequired,
    interventionUrgency,
    escalationProbability,
    deliveryBreakdownRisk,
    organizationalDrift: organizationalDriftScore,
    recommendedInterventionType,
    escalationTarget,
    machineOutput: {
      intervention_required: interventionRequired,
      escalation_probability: escalationProbability,
      delivery_breakdown_risk: deliveryBreakdownRisk,
      organizational_drift: organizationalDriftScore,
      recommended_intervention_type: recommendedInterventionType,
      escalation_target: escalationTarget,
    },
    commentary,
    deliveryInstability,
    operationalDriftSignal,
    stakeholderBreakdown,
    executionDeadlock,
    triggers,
    interventions,
    escalations,
    coordinationCollapse,
  };
}

export type ExecutiveInterventionRecommendation = {
  id: string;
  action: string;
  severity: "low" | "medium" | "high" | "critical";
  whyTriggered: string;
  relatedDomains: Array<"stakeholder_intelligence" | "delivery_intelligence" | "risk_intelligence" | "pmo_governance" | "team_health" | "executive_context" | "operational_memory">;
  confidenceLevel: number;
  operationalImpact: "low" | "medium" | "high";
};

const clampExecutive = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function buildExecutiveInterventions(input: {
  escalationLevel: "low" | "medium" | "high" | "critical";
  stakeholderPressure: number;
  deliveryRisk: number;
  pmFatigue: number;
  governanceGap: boolean;
}): ExecutiveInterventionRecommendation[] {
  const recommendations: ExecutiveInterventionRecommendation[] = [];
  if (input.stakeholderPressure >= 60 && input.deliveryRisk >= 55) {
    recommendations.push({ id: "align-sponsor-expectations", action: "Align sponsor expectations with current delivery constraints and tradeoffs.", severity: input.escalationLevel, whyTriggered: "Stakeholder pressure and delivery risk are elevated together.", relatedDomains: ["stakeholder_intelligence", "delivery_intelligence", "executive_context"], confidenceLevel: clampExecutive((input.stakeholderPressure + input.deliveryRisk) / 2), operationalImpact: "high" });
  }
  if (input.governanceGap) {
    recommendations.push({ id: "escalate-governance-gap", action: "Escalate governance gap and request missing operational artifacts.", severity: "high", whyTriggered: "Governance completeness and traceability are below threshold.", relatedDomains: ["pmo_governance", "operational_memory"], confidenceLevel: 82, operationalImpact: "high" });
  }
  if (input.pmFatigue >= 55) {
    recommendations.push({ id: "reduce-pm-overload", action: "Reduce PM coordination burden by consolidating recurring meetings and delegating ownership.", severity: input.escalationLevel === "critical" ? "high" : "medium", whyTriggered: "PM fatigue indicators are increasing with coordination load.", relatedDomains: ["team_health", "stakeholder_intelligence"], confidenceLevel: clampExecutive(input.pmFatigue), operationalImpact: "medium" });
  }
  if (!recommendations.length) {
    recommendations.push({ id: "maintain-cadence", action: "Maintain current cadence and monitor thresholds for cross-domain degradation.", severity: "low", whyTriggered: "No deterministic threshold breach currently requires intervention.", relatedDomains: ["operational_memory"], confidenceLevel: 70, operationalImpact: "low" });
  }
  return recommendations;
}
