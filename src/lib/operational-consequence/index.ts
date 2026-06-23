// ─── Service Functions ────────────────────────────────────────────────────────

export {
  generateOperationalConsequence,
  getOperationalConsequence,
  listOperationalConsequences,
  validateOperationalConsequence,
  archiveOperationalConsequence,
  getConsequenceAnalysis,
  getOperationalConsequenceLineageForConsequence,
} from "./consequence-registry";

// ─── Engines ──────────────────────────────────────────────────────────────────

export { calculateImpactScore, calculateConsequenceSeverity } from "./impact-engine";

export { analyzeCascadeEffects } from "./cascade-engine";

export { calculateEscalationProbability } from "./escalation-engine";

export { generateConsequenceScenarios } from "./scenario-engine";

export { calculateImpactHorizon } from "./horizon-engine";

export { generateDecisionSupport } from "./decision-support-engine";

export { getOperationalConsequenceLineage } from "./lineage-engine";

// ─── Explain ──────────────────────────────────────────────────────────────────

export { explainOperationalConsequences } from "./explain";

// ─── Types ────────────────────────────────────────────────────────────────────

export type {
  ConsequenceResult,
  ConsequenceEventType,
  ConsequenceSeverity,
  ConsequenceImpactHorizon,
  ConsequenceAnalysisStatus,
  ConsequenceImpactType,
  ConsequenceScenarioName,
  OperationalConsequenceRow,
  OperationalConsequenceImpactRow,
  OperationalConsequencePathRow,
  OperationalConsequenceScenarioRow,
  CascadeEffect,
  CascadeNode,
  ConsequenceScenario,
  DecisionSupport,
  ConsequenceLineage,
  ConsequenceLineageLayer,
  ConsequenceAnalysis,
  GenerateConsequenceInput,
  GetConsequenceInput,
  ListConsequencesInput,
  ValidateConsequenceInput,
  ArchiveConsequenceInput,
  GetConsequenceLineageInput,
  ExplainConsequenceInput,
} from "./types";
