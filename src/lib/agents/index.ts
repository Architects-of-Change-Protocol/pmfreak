export type {
  AgentToolCategory,
  AgentToolRiskLevel,
  AgentToolStatus,
  AgentToolExecutionMode,
  AgentToolAssignmentStatus,
  AgentToolRecord,
  AgentToolAssignmentRecord,
  RegisterAgentToolInput,
  ListAgentToolsFilter,
  CheckAgentToolEligibilityInput,
  AgentToolEligibilityResult,
  AgentToolResult,
} from "./agent-tool-types";

export {
  validateAgentToolKey,
  validateAgentToolCategory,
  validateAgentToolRiskLevel,
  validateAgentToolExecutionMode,
  normalizeRegisterAgentToolInput,
} from "./agent-tool-types";

export {
  registerAgentTool,
  upsertAgentTool,
  getAgentToolByKey,
  getAgentToolById,
  listAgentTools,
  updateAgentToolStatus,
  deleteOrDeprecateAgentTool,
  assignToolToAgent,
  ensureDefaultAgentTools,
  listAvailableToolsForAgent,
  checkAgentToolEligibility,
} from "./agent-tool-service";

export { DEFAULT_AGENT_TOOLS } from "./agent-tool-defaults";

// ─── Agent Tool Approval Layer ────────────────────────────────────────────────

export type {
  AgentToolRequestStatus,
  AgentToolApprovalDecision,
  AgentToolApprovalEventType,
  AgentToolAuthorizationState,
  AgentToolRequestRecord,
  AgentToolApprovalRecord,
  AgentToolApprovalEventRecord,
  CreateAgentToolRequestInput,
  DecideAgentToolApprovalInput,
  AgentToolAuthorizationResult,
  AgentToolRequestListFilters,
} from "./agent-tool-approval-types";

export {
  detectSensitivePayloadKeys,
  validateRequestContext,
  validateCreateAgentToolRequestInput,
  validateDecideAgentToolApprovalInput,
  isValidApprovalDecision,
} from "./agent-tool-approval-validation";

export { requiresApprovalForTool } from "./agent-tool-approval-policy";

export {
  createAgentToolRequest,
  getAgentToolRequestById,
  listAgentToolRequests,
  updateAgentToolRequestStatus,
  recordAgentToolApproval,
  listApprovalsForRequest,
  recordAgentToolApprovalEvent,
  listApprovalEventsForRequest,
} from "./agent-tool-approval-registry";

export {
  requestAgentToolAuthorization,
  decideAgentToolApproval,
  getAgentToolAuthorizationState,
  cancelAgentToolRequest,
  revokeAgentToolApproval,
} from "./agent-tool-approval-service";

// ─── Agent Memory & Context Layer ─────────────────────────────────────────────

export type {
  AgentContextScopeType,
  AgentMemoryKind,
  AgentMemoryStatus,
  AgentContextSensitivity,
  AgentContextSourceType,
  AgentMemoryRetentionPolicy,
  AgentMemoryEventType,
  AgentMemoryAccessState,
  AgentContextPolicyStatus,
  AgentContextPolicyRecord,
  AgentMemoryRecord,
  AgentMemoryEventRecord,
  AgentContextWindowRecord,
  CreateAgentMemoryInput,
  CreateAgentContextPolicyInput,
  AgentMemoryListFilters,
  AgentMemoryAccessCheckInput,
  AgentMemoryAccessResult,
} from "./agent-memory-types";

export {
  validateAgentContextScopeType,
  validateAgentMemoryKind,
  validateAgentMemoryStatus,
  validateAgentContextSensitivity,
  validateAgentContextSourceType,
  validateAgentMemoryRetentionPolicy,
  validateAgentMemoryEventType,
  validateAgentContextPolicyStatus,
  assertAgentMemoryPayloadSerializable,
  normalizeCreateAgentMemoryInput,
  normalizeCreateAgentContextPolicyInput,
} from "./agent-memory-validation";

export {
  getSensitivityRank,
  isSensitivityAllowed,
  calculateExpiration,
  evaluateMemoryPolicy,
} from "./agent-memory-policy";

export {
  createAgentContextPolicy,
  upsertAgentContextPolicy,
  getAgentContextPolicyByKey,
  listAgentContextPolicies,
  createAgentMemory,
  getAgentMemoryById,
  listAgentMemories,
  updateAgentMemoryStatus,
  markAgentMemoryAccessed,
  recordAgentMemoryEvent,
  listAgentMemoryEvents,
} from "./agent-memory-registry";

export {
  ensureDefaultAgentContextPolicy,
  createGovernedAgentMemory,
  checkAgentMemoryAccess,
  listAvailableMemoryForAgent,
  markMemoryStale,
  expireMemory,
  revokeMemory,
  archiveMemory,
} from "./agent-memory-service";
