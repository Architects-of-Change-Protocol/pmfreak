// ─────────────────────────────────────────────────────────────────────────────
// Governance Signal Engine — Public API
// EPIC 3, Sprint 1
// ─────────────────────────────────────────────────────────────────────────────

// Service functions
export {
  detectSignal,
  acknowledgeSignal,
  resolveSignal,
  dismissSignal,
  getSignal,
  listSignals,
  detectGovernanceSignalsForWorkspace,
  correlateWorkspaceSignals,
  getGovernanceHealth,
} from "./signal-registry";

// Detection engine
export { detectGovernanceSignals } from "./detection-engine";
export type { DetectedSignalCandidate } from "./detection-engine";

// Confidence engine
export {
  calculateSignalConfidence,
  deriveEvidenceStrength,
  deriveHistoricalFrequency,
  deriveContextAdjustment,
} from "./confidence-engine";
export type { ConfidenceFactors, ConfidenceResult } from "./confidence-engine";

// Severity engine
export { calculateSignalSeverity, durationDaysSince } from "./severity-engine";

// Correlation engine
export { correlateSignals } from "./correlation-engine";

// Health engine
export { calculateGovernanceHealth } from "./health-engine";

// Recommendation engine
export { generateSignalRecommendations } from "./recommendation-engine";
export type { RecommendationLink } from "./recommendation-engine";

// Lineage
export { getSignalLineage } from "./lineage";

// Explain
export { explainGovernanceSignals } from "./explain";
export type { GovernanceSignalExplanation } from "./explain";

// Types
export type {
  GovernanceSignalType,
  GovernanceSignalSeverity,
  GovernanceSignalStatus,
  GovernanceSignalSource,
  GovernanceSignalEvidenceType,
  GovernanceSignalResult,
  GovernanceSignalEventType,
  DetectSignalInput,
  AcknowledgeSignalInput,
  ResolveSignalInput,
  DismissSignalInput,
  ListSignalsInput,
  DetectGovernanceSignalsInput,
  SignalEvidenceItem,
  SignalWithEvidence,
  SignalCorrelation,
  GovernanceHealthScore,
  SignalLineage,
  DetectionSummary,
} from "./types";

export {
  GOVERNANCE_SIGNAL_TYPES,
  GOVERNANCE_SIGNAL_SEVERITIES,
  GOVERNANCE_SIGNAL_STATUSES,
  GOVERNANCE_SIGNAL_SOURCES,
} from "./types";
