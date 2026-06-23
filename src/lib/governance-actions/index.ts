// ─────────────────────────────────────────────────────────────────────────────
// Governance Action Engine — Public API
// EPIC 3, Sprint 2
// ─────────────────────────────────────────────────────────────────────────────

// Service functions
export {
  generateAction,
  generateActionsForSignal,
  assignAction,
  approveAction,
  rejectAction,
  completeAction,
  expireAction,
  getAction,
  listActions,
  generateGovernanceActions,
  getActionLineageForAction,
} from "./action-registry";

// Generation engine
export { generateActionsForSignalType } from "./generation-engine";
export type { SignalContext } from "./generation-engine";

// Priority engine
export { calculateActionPriority } from "./priority-engine";
export type { ActionPriorityResult } from "./priority-engine";

// Confidence engine
export { calculateActionConfidence } from "./confidence-engine";
export type { ActionConfidenceFactors, ActionConfidenceResult } from "./confidence-engine";

// Authority engine
export {
  validateActionAuthority,
  getRequiredAuthorityForAction,
  getRecommendedOwnerTypeForAction,
} from "./authority-engine";
export type { AuthorityValidationInput } from "./authority-engine";

// Deadline engine
export { calculateRecommendedDueDate, deadlineHoursForPriority } from "./deadline-engine";

// Intervention engine
export { simulateGovernanceIntervention } from "./intervention-engine";

// Justification engine
export { generateActionJustification } from "./justification-engine";
export type { JustificationInput, JustificationResult } from "./justification-engine";

// Lineage
export { getActionLineage } from "./lineage";

// Explain
export { explainGovernanceActions } from "./explain";
export type { GovernanceActionExplanation } from "./explain";

// Types
export type {
  GovernanceActionType,
  GovernanceActionPriority,
  GovernanceActionStatus,
  GovernanceActionAssignmentStatus,
  GovernanceActionResult,
  GovernanceActionEventType,
  GenerateActionInput,
  GenerateActionsForSignalInput,
  AssignActionInput,
  ApproveActionInput,
  RejectActionInput,
  CompleteActionInput,
  ExpireActionInput,
  GetActionInput,
  ListActionsInput,
  GenerateGovernanceActionsInput,
  ActionWithEvidence,
  AuthorityValidationResult,
  InterventionSimulation,
  ActionLineage,
  ActionCandidate,
  GenerateActionsResult,
  GovernanceActionRow,
  GovernanceActionEvidenceRow,
  GovernanceActionAssignmentRow,
} from "./types";

export {
  GOVERNANCE_ACTION_TYPES,
  GOVERNANCE_ACTION_PRIORITIES,
  GOVERNANCE_ACTION_STATUSES,
} from "./types";
