import type { ProjectMemorySnapshot, StakeholderMemory } from "@/lib/memory/organization-memory";
import { assessDependencyPropagation } from "@/lib/cross-signal-reasoning";

export enum ProjectRiskLevel {
  Low = "low",
  Medium = "medium",
  High = "high",
  Critical = "critical",
}

export enum RiskCategory {
  DeliveryConfidence = "delivery_confidence",
  StakeholderPressure = "stakeholder_pressure",
  ProjectSilence = "project_silence",
  DeadlineDrift = "deadline_drift",
  ScopeInstability = "scope_instability",
  DependencyRisk = "dependency_risk",
}

export enum EscalationSeverity {
  None = "none",
  Watch = "watch",
  Elevated = "elevated",
  Immediate = "immediate",
}

export type ExecutionSignal = {
  category: RiskCategory;
  score: number;
  level: ProjectRiskLevel;
  severity: EscalationSeverity;
  summary: string;
};

export type StakeholderPressureSignal = ExecutionSignal & { category: RiskCategory.StakeholderPressure; pressureMentions: number };
export type DeliveryConfidenceSignal = ExecutionSignal & { category: RiskCategory.DeliveryConfidence; blockerLoad: number };
export type SilenceRiskSignal = ExecutionSignal & { category: RiskCategory.ProjectSilence; daysSilent: number };
export type DeadlineDriftSignal = ExecutionSignal & { category: RiskCategory.DeadlineDrift; unresolvedCommitments: number };
export type ScopeInstabilitySignal = ExecutionSignal & { category: RiskCategory.ScopeInstability; scopeChangeIndicators: number };
export type DependencyRiskSignal = ExecutionSignal & { category: RiskCategory.DependencyRisk; dependencyCount: number; unresolvedIssues: number };

export type ExecutionRiskSnapshot = {
  projectId: string | null;
  generatedAt: string;
  /** 'empty' when no execution memory exists yet — signals are honest zeros, never inferred risk. */
  state: "empty" | "populated";
  deliveryConfidence: ProjectRiskLevel;
  stakeholderPressure: ProjectRiskLevel;
  executionStability: "stable" | "watching" | "degrading";
  activeEscalationRisk: EscalationSeverity;
  overallRisk: ProjectRiskLevel;
  machineSummary: {
    delivery_confidence: ProjectRiskLevel;
    stakeholder_pressure: ProjectRiskLevel;
    execution_stability: "stable" | "watching" | "degrading";
    active_escalation_risk: EscalationSeverity;
  };
  commentary: string[];
  signals: ExecutionSignal[];
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const toLevel = (score: number): ProjectRiskLevel => {
  if (score >= 85) return ProjectRiskLevel.Critical;
  if (score >= 65) return ProjectRiskLevel.High;
  if (score >= 40) return ProjectRiskLevel.Medium;
  return ProjectRiskLevel.Low;
};

const toSeverity = (score: number): EscalationSeverity => {
  if (score >= 85) return EscalationSeverity.Immediate;
  if (score >= 65) return EscalationSeverity.Elevated;
  if (score >= 40) return EscalationSeverity.Watch;
  return EscalationSeverity.None;
};

const normalizeDaysSinceUpdate = (lastUpdatedAt: string | null): number => {
  if (!lastUpdatedAt) return 30;
  const updatedTime = Date.parse(lastUpdatedAt);
  if (Number.isNaN(updatedTime)) return 30;
  return Math.max(0, Math.floor((Date.now() - updatedTime) / 86_400_000));
};

export const calculateDeliveryConfidence = (snapshot: ProjectMemorySnapshot | null): DeliveryConfidenceSignal => {
  if (!snapshot) {
    // No execution memory yet: absence of data is not risk, so the signal stays at zero.
    return { category: RiskCategory.DeliveryConfidence, score: 0, level: ProjectRiskLevel.Low, severity: EscalationSeverity.None, summary: "No execution data yet.", blockerLoad: 0 };
  }

  const blockerLoad = snapshot.project.blockers.length + snapshot.project.unresolvedIssues.length;
  const riskScore = clamp(blockerLoad * 15 + snapshot.project.risks.length * 10);
  return {
    category: RiskCategory.DeliveryConfidence,
    score: riskScore,
    level: toLevel(riskScore),
    severity: toSeverity(riskScore),
    summary: riskScore >= 65 ? "Delivery confidence degraded due to unresolved blockers." : "Delivery confidence remains within controllable thresholds.",
    blockerLoad,
  };
};

export const detectStakeholderPressure = (snapshot: ProjectMemorySnapshot | null): StakeholderPressureSignal => {
  if (!snapshot) {
    return { category: RiskCategory.StakeholderPressure, score: 0, level: ProjectRiskLevel.Low, severity: EscalationSeverity.None, summary: "No stakeholder interaction data yet.", pressureMentions: 0 };
  }

  const pressureMentions = snapshot.stakeholders.reduce((sum: number, item: StakeholderMemory) => sum + item.pressurePatterns.length + item.sentimentSignals.length, 0);
  const highInfluenceStakeholders = snapshot.stakeholders.filter((item) => item.influence === "high").length;
  const riskScore = clamp(pressureMentions * 10 + highInfluenceStakeholders * 8);

  return {
    category: RiskCategory.StakeholderPressure,
    score: riskScore,
    level: toLevel(riskScore),
    severity: toSeverity(riskScore),
    summary: riskScore >= 65 ? "Stakeholder pressure increasing without corresponding delivery movement." : "Stakeholder pressure remains manageable based on current interaction patterns.",
    pressureMentions,
  };
};

export const detectProjectSilence = (snapshot: ProjectMemorySnapshot | null): SilenceRiskSignal => {
  if (!snapshot) {
    // A workspace with no memory records has no momentum to lose — silence risk
    // only exists once execution activity has been recorded.
    return { category: RiskCategory.ProjectSilence, score: 0, level: ProjectRiskLevel.Low, severity: EscalationSeverity.None, summary: "No execution activity recorded yet.", daysSilent: 0 };
  }
  const daysSilent = normalizeDaysSinceUpdate(snapshot.lastUpdatedAt ?? null);
  const riskScore = clamp(daysSilent * 6);
  return {
    category: RiskCategory.ProjectSilence,
    score: riskScore,
    level: toLevel(riskScore),
    severity: toSeverity(riskScore),
    summary: daysSilent >= 7 ? "Project momentum collapsed during the last 7 days." : "Execution activity has recent signal continuity.",
    daysSilent,
  };
};

export const detectScopeInstability = (snapshot: ProjectMemorySnapshot | null): ScopeInstabilitySignal => {
  const scopeChangeIndicators = snapshot ? snapshot.project.commitments.length : 0;
  const concernScore = snapshot?.detectedConcerns.length ?? 0;
  const riskScore = clamp(scopeChangeIndicators * 16 + concernScore * 8);

  return {
    category: RiskCategory.ScopeInstability,
    score: riskScore,
    level: toLevel(riskScore),
    severity: toSeverity(riskScore),
    summary: riskScore >= 65 ? "Scope instability detected from unresolved ambiguity and concern patterns." : "Scope boundaries appear relatively stable.",
    scopeChangeIndicators,
  };
};

export const detectDeadlineDrift = (snapshot: ProjectMemorySnapshot | null): DeadlineDriftSignal => {
  const unresolvedCommitments = snapshot?.project.commitments.length ?? 0;
  const decisionLag = snapshot?.decisions.filter((decision) => decision.unresolvedConsequences.length > 0).length ?? 0;
  const riskScore = clamp(unresolvedCommitments * 10 + decisionLag * 12);

  return {
    category: RiskCategory.DeadlineDrift,
    score: riskScore,
    level: toLevel(riskScore),
    severity: toSeverity(riskScore),
    summary: riskScore >= 65 ? "Milestone predictability is drifting due to unresolved commitments." : "Deadline drift is currently contained.",
    unresolvedCommitments,
  };
};

const detectDependencyRisk = (snapshot: ProjectMemorySnapshot | null): DependencyRiskSignal => {
  const dependencyCount = snapshot?.project.dependencies.length ?? 0;
  const unresolvedIssues = snapshot?.project.unresolvedIssues.length ?? 0;
  const daysSilent = normalizeDaysSinceUpdate(snapshot?.lastUpdatedAt ?? null);

  // Dependency aging amplifies risk: unresolved dependencies that persist through silence
  // are increasingly likely to be forgotten or to cause cascading downstream blockage.
  const agingFactor = daysSilent >= 7 && unresolvedIssues >= 2 ? clamp(daysSilent * 1.5) : 0;
  const riskScore = clamp(dependencyCount * 9 + unresolvedIssues * 11 + agingFactor);

  // Propagation: assess whether this dependency load is threatening adjacent domains
  const pressureMentions = snapshot?.stakeholders.reduce((sum, s) => sum + s.pressurePatterns.length + s.sentimentSignals.length, 0) ?? 0;
  const propagation = assessDependencyPropagation({
    dependencyCount,
    unresolvedIssues,
    deliveryRiskScore: clamp((snapshot?.project.blockers.length ?? 0) * 15 + (snapshot?.project.risks.length ?? 0) * 10),
    stakeholderPressureScore: clamp(pressureMentions * 10),
    daysSilent,
  });

  const summary =
    propagation.propagationRisk === "critical"
      ? `Dependency chain is propagating risk across multiple operational domains — ${propagation.causalChain[0] ?? "cascading impact active"}.`
      : propagation.propagationRisk === "elevated"
        ? `Dependency load (${dependencyCount} deps) is amplifying adjacent delivery and stakeholder risk.`
        : riskScore >= 65
          ? "Dependency execution risk is elevated due to unresolved cross-team issues."
          : "Dependency pathways are visible with moderate control.";

  return {
    category: RiskCategory.DependencyRisk,
    score: riskScore,
    level: toLevel(riskScore),
    severity: toSeverity(riskScore),
    summary,
    dependencyCount,
    unresolvedIssues,
  };
};

// These operational signals are intentionally deterministic so future AI orchestration
// layers can reason over consistent telemetry instead of brittle conversational memory.
// Escalation agents can use the typed severity rails below to trigger policy-safe nudges,
// while autonomous execution assistants can evolve from watch-mode to active intervention.
export const buildExecutionRiskSnapshot = (projectId: string | null, snapshot: ProjectMemorySnapshot | null): ExecutionRiskSnapshot => {
  const signals: ExecutionSignal[] = [
    calculateDeliveryConfidence(snapshot),
    detectStakeholderPressure(snapshot),
    detectProjectSilence(snapshot),
    detectScopeInstability(snapshot),
    detectDeadlineDrift(snapshot),
    detectDependencyRisk(snapshot),
  ];

  const weightedScore = clamp(signals.reduce((sum, signal) => sum + signal.score, 0) / signals.length);
  const escalationSignal = signals.reduce((worst, signal) => (signal.score > worst.score ? signal : worst), signals[0]);

  const deliveryConfidence = signals.find((signal) => signal.category === RiskCategory.DeliveryConfidence)?.level ?? ProjectRiskLevel.Medium;
  const stakeholderPressure = signals.find((signal) => signal.category === RiskCategory.StakeholderPressure)?.level ?? ProjectRiskLevel.Low;

  const degradingSignals = signals.filter((signal) => signal.score >= 65).length;
  const executionStability = degradingSignals >= 3 ? "degrading" : degradingSignals >= 1 ? "watching" : "stable";

  // Cross-signal compound deterioration: when 3+ signals co-degrade, add a causality note
  // to the commentary so the executive layer understands this is compound, not isolated.
  const elevatedSignals = signals.filter((s) => s.score >= 55);
  const compoundNote =
    elevatedSignals.length >= 3
      ? `Compound deterioration: ${elevatedSignals.map((s) => s.category.replace("_", " ")).join(", ")} are co-degrading — severity is multiplicative, not additive.`
      : elevatedSignals.length >= 2
        ? `${elevatedSignals[0].category.replace("_", " ")} is amplifying ${elevatedSignals[1].category.replace("_", " ")} — these signals are reinforcing each other.`
        : null;

  const baseCommentary = signals.filter((signal) => signal.score >= 50).map((signal) => signal.summary).slice(0, 4);
  const commentary = compoundNote ? [compoundNote, ...baseCommentary] : baseCommentary;

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    state: snapshot ? "populated" : "empty",
    deliveryConfidence,
    stakeholderPressure,
    executionStability,
    activeEscalationRisk: escalationSignal.severity,
    overallRisk: toLevel(weightedScore),
    machineSummary: {
      delivery_confidence: deliveryConfidence,
      stakeholder_pressure: stakeholderPressure,
      execution_stability: executionStability,
      active_escalation_risk: escalationSignal.severity,
    },
    commentary: commentary.length > 0
      ? commentary
      : snapshot
        ? ["Execution signals are present but no major escalation patterns are active."]
        : [],
    signals,
  };
};
