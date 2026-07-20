// Screens are NOT re-exported here — see recommendations/index.ts for why:
// a Route is a Screen's only consumer, imported from its concrete path so
// this module's server-only permission checks never enter another module's
// client-component bundle graph via this barrel.
export { DecisionList } from "./features/DecisionList";
export { DecisionDetail } from "./features/DecisionDetail";
export { useProjectDecisions, useDecision, createDecision, approveDecision, rejectDecision } from "./contracts/decisions.contract";
export type { DecisionRecord, DecisionSummary, DecisionLineage, DecisionType, DecisionEvidenceRelationship } from "./contracts/decisions.contract";
