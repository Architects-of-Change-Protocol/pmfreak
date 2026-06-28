// ─── Agent Tool Registry — Types ─────────────────────────────────────────────

export type AgentToolCategory =
  | "project_read"
  | "portfolio_read"
  | "pm_read"
  | "analysis"
  | "drafting"
  | "recommendation"
  | "task_generation"
  | "communication"
  | "governance"
  | "reporting"
  | "administration";

export type AgentToolRiskLevel = "low" | "medium" | "high" | "critical";

export type AgentToolStatus = "active" | "disabled" | "deprecated";

export type AgentToolExecutionMode =
  | "read_only"
  | "draft_only"
  | "requires_approval"
  | "automatic";

export type AgentToolAssignmentStatus = "active" | "removed";

// ─── Records ──────────────────────────────────────────────────────────────────

export type AgentToolRecord = {
  id: string;
  workspaceId: string;
  toolKey: string;
  displayName: string;
  description: string;
  category: AgentToolCategory;
  riskLevel: AgentToolRiskLevel;
  executionMode: AgentToolExecutionMode;
  status: AgentToolStatus;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  requiredPermissions: string[];
  compatibleAgentTypes: string[];
  createsEvidence: boolean;
  mutatesState: boolean;
  requiresHumanApproval: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AgentToolAssignmentRecord = {
  id: string;
  workspaceId: string;
  agentId: string;
  toolId: string;
  status: AgentToolAssignmentStatus;
  assignedAt: string;
  assignedBy: string | null;
  removedAt: string | null;
};

// ─── Inputs ───────────────────────────────────────────────────────────────────

export type RegisterAgentToolInput = {
  workspaceId: string;
  toolKey: string;
  displayName: string;
  description: string;
  category: AgentToolCategory;
  riskLevel: AgentToolRiskLevel;
  executionMode: AgentToolExecutionMode;
  inputSchema?: Record<string, unknown> | null;
  outputSchema?: Record<string, unknown> | null;
  requiredPermissions?: string[];
  compatibleAgentTypes?: string[];
  createsEvidence?: boolean;
  mutatesState?: boolean;
  requiresHumanApproval?: boolean;
};

export type ListAgentToolsFilter = {
  category?: AgentToolCategory;
  riskLevel?: AgentToolRiskLevel;
  executionMode?: AgentToolExecutionMode;
  status?: AgentToolStatus;
  includeDisabled?: boolean;
};

export type CheckAgentToolEligibilityInput = {
  workspaceId: string;
  agentId?: string;
  agentType: string;
  toolKey: string;
  grantedPermissions?: string[];
  allowApprovalRequiredTools?: boolean;
};

// ─── Results ──────────────────────────────────────────────────────────────────

export type AgentToolEligibilityResult = {
  eligible: boolean;
  reasonCode:
    | "eligible"
    | "tool_not_found"
    | "tool_disabled"
    | "tool_deprecated"
    | "agent_type_not_compatible"
    | "missing_permission"
    | "human_approval_required"
    | "execution_mode_not_allowed";
  message: string;
  requiredApproval: boolean;
  riskLevel?: AgentToolRiskLevel;
};

export type AgentToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set<string>([
  "project_read","portfolio_read","pm_read","analysis","drafting",
  "recommendation","task_generation","communication","governance",
  "reporting","administration",
]);
const VALID_RISK_LEVELS = new Set<string>(["low","medium","high","critical"]);
const VALID_EXECUTION_MODES = new Set<string>([
  "read_only","draft_only","requires_approval","automatic",
]);
const TOOL_KEY_RE = /^[a-z][a-z0-9_]{0,118}$/;

export function validateAgentToolKey(toolKey: string): string | null {
  if (!toolKey) return "tool_key is required";
  if (!TOOL_KEY_RE.test(toolKey)) return "tool_key must be lowercase snake_case, max 120 chars";
  return null;
}

export function validateAgentToolCategory(category: string): category is AgentToolCategory {
  return VALID_CATEGORIES.has(category);
}

export function validateAgentToolRiskLevel(riskLevel: string): riskLevel is AgentToolRiskLevel {
  return VALID_RISK_LEVELS.has(riskLevel);
}

export function validateAgentToolExecutionMode(mode: string): mode is AgentToolExecutionMode {
  return VALID_EXECUTION_MODES.has(mode);
}

export function normalizeRegisterAgentToolInput(
  raw: RegisterAgentToolInput
): { value: RegisterAgentToolInput; error: string | null } {
  const keyErr = validateAgentToolKey(raw.toolKey);
  if (keyErr) return { value: raw, error: keyErr };
  if (!raw.displayName?.trim()) return { value: raw, error: "displayName is required" };
  if (!raw.description?.trim()) return { value: raw, error: "description is required" };
  if (!validateAgentToolCategory(raw.category)) return { value: raw, error: `Invalid category: ${raw.category}` };
  if (!validateAgentToolRiskLevel(raw.riskLevel)) return { value: raw, error: `Invalid riskLevel: ${raw.riskLevel}` };
  if (!validateAgentToolExecutionMode(raw.executionMode)) return { value: raw, error: `Invalid executionMode: ${raw.executionMode}` };
  return { value: raw, error: null };
}
