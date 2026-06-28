// ─── Agent Tool Execution Adapter Layer — Registry ────────────────────────────

import type {
  AgentToolAdapterDefinition,
  AgentToolAdapterEligibilityResult,
  AgentToolAdapterExecutionMode,
} from "./agent-tool-adapter-types";
import type { AgentExecutionRequestRecord } from "./agent-execution-types";

// ─── Default Scope Types ──────────────────────────────────────────────────────

const DEFAULT_SCOPE_TYPES = [
  "workspace", "portfolio", "project", "pm", "agent",
  "tool_request", "approval_request", "memory_record",
];

// ─── Default Adapters ─────────────────────────────────────────────────────────

const DEFAULT_ADAPTERS: AgentToolAdapterDefinition[] = [
  {
    adapterKey: "noop_adapter",
    displayName: "No-Op Adapter",
    description: "Performs no operation. Used for testing, validation, and dry-run verification of the adapter pipeline.",
    status: "enabled",
    supportedToolKeys: ["noop", "test_noop", "validate_execution_request"],
    supportedExecutionModes: ["dry_run"],
    supportedScopeTypes: DEFAULT_SCOPE_TYPES,
    outputTypes: ["noop", "simulation"],
    riskPolicy: "medium_or_lower",
    sideEffectPolicy: "none",
    requiresApprovalByDefault: false,
    supportsDryRun: true,
    supportsDraftOnly: false,
    externalSideEffectsPossible: false,
    externalSideEffectsEnabled: false,
    version: "1.0.0",
    owner: null,
    policyNotes: [],
  },
  {
    adapterKey: "draft_email_adapter",
    displayName: "Draft Email Adapter",
    description: "Generates a draft email from a governed execution request. Does not send emails. Requires human review before any action.",
    status: "enabled",
    supportedToolKeys: ["draft_client_email", "draft_internal_email", "prepare_status_email"],
    supportedExecutionModes: ["dry_run", "draft_only"],
    supportedScopeTypes: DEFAULT_SCOPE_TYPES,
    outputTypes: ["draft_email"],
    riskPolicy: "high_with_approval",
    sideEffectPolicy: "internal_draft_only",
    requiresApprovalByDefault: false,
    supportsDryRun: true,
    supportsDraftOnly: true,
    externalSideEffectsPossible: false,
    externalSideEffectsEnabled: false,
    version: "1.0.0",
    owner: null,
    policyNotes: [],
  },
  {
    adapterKey: "draft_task_adapter",
    displayName: "Draft Task Adapter",
    description: "Generates a draft task or action item from a governed execution request. Does not create tasks in external systems.",
    status: "enabled",
    supportedToolKeys: ["draft_project_task", "draft_follow_up_task", "prepare_action_item"],
    supportedExecutionModes: ["dry_run", "draft_only"],
    supportedScopeTypes: DEFAULT_SCOPE_TYPES,
    outputTypes: ["draft_task"],
    riskPolicy: "high_with_approval",
    sideEffectPolicy: "internal_draft_only",
    requiresApprovalByDefault: false,
    supportsDryRun: true,
    supportsDraftOnly: true,
    externalSideEffectsPossible: false,
    externalSideEffectsEnabled: false,
    version: "1.0.0",
    owner: null,
    policyNotes: [],
  },
  {
    adapterKey: "draft_project_update_adapter",
    displayName: "Draft Project Update Adapter",
    description: "Generates a draft project update or milestone update from a governed execution request. Does not apply updates to projects.",
    status: "enabled",
    supportedToolKeys: ["draft_project_update", "prepare_status_update", "draft_milestone_update"],
    supportedExecutionModes: ["dry_run", "draft_only"],
    supportedScopeTypes: DEFAULT_SCOPE_TYPES,
    outputTypes: ["draft_project_update"],
    riskPolicy: "high_with_approval",
    sideEffectPolicy: "internal_draft_only",
    requiresApprovalByDefault: false,
    supportsDryRun: true,
    supportsDraftOnly: true,
    externalSideEffectsPossible: false,
    externalSideEffectsEnabled: false,
    version: "1.0.0",
    owner: null,
    policyNotes: [],
  },
  {
    adapterKey: "executive_summary_adapter",
    displayName: "Executive Summary Adapter",
    description: "Generates a structured executive summary or draft report from a governed execution request. Deterministic, no LLM calls.",
    status: "enabled",
    supportedToolKeys: ["generate_executive_summary", "draft_executive_report", "summarize_project_status"],
    supportedExecutionModes: ["dry_run", "draft_only"],
    supportedScopeTypes: DEFAULT_SCOPE_TYPES,
    outputTypes: ["structured_summary", "draft_report"],
    riskPolicy: "medium_or_lower",
    sideEffectPolicy: "internal_draft_only",
    requiresApprovalByDefault: false,
    supportsDryRun: true,
    supportsDraftOnly: true,
    externalSideEffectsPossible: false,
    externalSideEffectsEnabled: false,
    version: "1.0.0",
    owner: null,
    policyNotes: [],
  },
  {
    adapterKey: "risk_analysis_adapter",
    displayName: "Risk Analysis Adapter",
    description: "Generates a draft risk analysis or risk escalation note from a governed execution request. Deterministic, no LLM calls.",
    status: "enabled",
    supportedToolKeys: ["analyze_project_risk", "draft_risk_note", "prepare_risk_escalation"],
    supportedExecutionModes: ["dry_run", "draft_only"],
    supportedScopeTypes: DEFAULT_SCOPE_TYPES,
    outputTypes: ["risk_analysis", "recommendation"],
    riskPolicy: "high_with_approval",
    sideEffectPolicy: "internal_draft_only",
    requiresApprovalByDefault: false,
    supportsDryRun: true,
    supportsDraftOnly: true,
    externalSideEffectsPossible: false,
    externalSideEffectsEnabled: false,
    version: "1.0.0",
    owner: null,
    policyNotes: [],
  },
];

// ─── Exports ──────────────────────────────────────────────────────────────────

export function getDefaultAgentToolAdapters(): AgentToolAdapterDefinition[] {
  return DEFAULT_ADAPTERS;
}

export function getAgentToolAdapterByKey(adapterKey: string): AgentToolAdapterDefinition | null {
  return DEFAULT_ADAPTERS.find((a) => a.adapterKey === adapterKey) ?? null;
}

export function findAgentToolAdaptersForToolKey(toolKey: string): AgentToolAdapterDefinition[] {
  return DEFAULT_ADAPTERS.filter((a) => a.supportedToolKeys.includes(toolKey));
}

export function selectAgentToolAdapterForExecutionRequest(input: {
  toolKey: string;
  executionMode: string;
  scopeType: string;
  riskLevel: string;
  requiresApproval: boolean;
  approvalRequestId?: string | null;
}): AgentToolAdapterDefinition | null {
  const candidates = findAgentToolAdaptersForToolKey(input.toolKey);
  for (const adapter of candidates) {
    if (adapter.status !== "enabled") continue;
    if (!adapter.supportedExecutionModes.includes(input.executionMode as AgentToolAdapterExecutionMode)) continue;
    if (!adapter.supportedScopeTypes.includes(input.scopeType)) continue;
    return adapter;
  }
  return null;
}

// ─── Eligibility Evaluation ───────────────────────────────────────────────────

export function evaluateAgentToolAdapterEligibility(input: {
  adapter: AgentToolAdapterDefinition | null;
  executionRequest: AgentExecutionRequestRecord | null;
}): AgentToolAdapterEligibilityResult {
  const { adapter, executionRequest } = input;
  const checks: Array<{ key: string; passed: boolean; message: string }> = [];

  // 1. Execution request exists
  if (!executionRequest) {
    checks.push({ key: "execution_request_found", passed: false, message: "Execution request not found" });
    return { eligible: false, adapterKey: adapter?.adapterKey ?? null, reasonCode: "execution_request_not_found", message: "Execution request not found", checks };
  }
  checks.push({ key: "execution_request_found", passed: true, message: "Execution request found" });

  // 2. Execution request is ready
  if (executionRequest.executionState !== "ready_for_execution") {
    checks.push({ key: "execution_request_ready", passed: false, message: `Execution request state is "${executionRequest.executionState}", expected "ready_for_execution"` });
    return { eligible: false, adapterKey: adapter?.adapterKey ?? null, reasonCode: "execution_request_not_ready", message: `Execution request is not ready for execution (state: ${executionRequest.executionState})`, checks };
  }
  checks.push({ key: "execution_request_ready", passed: true, message: "Execution request is ready for execution" });

  // 3. Adapter exists
  if (!adapter) {
    checks.push({ key: "adapter_found", passed: false, message: "No adapter found for this tool key and execution mode" });
    return { eligible: false, adapterKey: null, reasonCode: "adapter_not_found", message: "No adapter found for this tool key and execution mode", checks };
  }
  checks.push({ key: "adapter_found", passed: true, message: `Adapter "${adapter.adapterKey}" found` });

  // 4. Adapter is enabled
  if (adapter.status === "disabled" || adapter.status === "deprecated") {
    checks.push({ key: "adapter_enabled", passed: false, message: `Adapter status is "${adapter.status}"` });
    return { eligible: false, adapterKey: adapter.adapterKey, reasonCode: "adapter_disabled", message: `Adapter is ${adapter.status}`, checks };
  }
  checks.push({ key: "adapter_enabled", passed: true, message: "Adapter is enabled" });

  // 5. Execution mode is supported (not approved_execution or approval_required)
  const mode = executionRequest.executionMode;
  if (mode === "approved_execution" || mode === "approval_required") {
    checks.push({ key: "execution_mode_supported", passed: false, message: `Execution mode "${mode}" is not supported by adapter layer` });
    return { eligible: false, adapterKey: adapter.adapterKey, reasonCode: "unsupported_execution_mode", message: `Execution mode "${mode}" is not supported by the adapter layer`, checks };
  }
  if (!adapter.supportedExecutionModes.includes(mode as AgentToolAdapterExecutionMode)) {
    checks.push({ key: "execution_mode_supported", passed: false, message: `Adapter does not support execution mode "${mode}"` });
    return { eligible: false, adapterKey: adapter.adapterKey, reasonCode: "unsupported_execution_mode", message: `Adapter does not support execution mode "${mode}"`, checks };
  }
  checks.push({ key: "execution_mode_supported", passed: true, message: `Execution mode "${mode}" is supported` });

  // 6. Tool key supported
  if (!adapter.supportedToolKeys.includes(executionRequest.toolKey)) {
    checks.push({ key: "tool_key_supported", passed: false, message: `Adapter does not support tool key "${executionRequest.toolKey}"` });
    return { eligible: false, adapterKey: adapter.adapterKey, reasonCode: "unsupported_tool_key", message: `Adapter does not support tool key "${executionRequest.toolKey}"`, checks };
  }
  checks.push({ key: "tool_key_supported", passed: true, message: `Tool key "${executionRequest.toolKey}" is supported` });

  // 7. Scope type supported
  if (!adapter.supportedScopeTypes.includes(executionRequest.scopeType)) {
    checks.push({ key: "scope_type_supported", passed: false, message: `Adapter does not support scope type "${executionRequest.scopeType}"` });
    return { eligible: false, adapterKey: adapter.adapterKey, reasonCode: "unsupported_scope_type", message: `Adapter does not support scope type "${executionRequest.scopeType}"`, checks };
  }
  checks.push({ key: "scope_type_supported", passed: true, message: `Scope type "${executionRequest.scopeType}" is supported` });

  // 8. Risk policy check
  const riskLevel = executionRequest.riskLevel;
  const riskPolicy = adapter.riskPolicy;

  if (riskPolicy === "critical_blocked" || riskLevel === "critical") {
    checks.push({ key: "risk_policy", passed: false, message: `Risk policy "${riskPolicy}" or risk level "${riskLevel}" blocks execution` });
    return { eligible: false, adapterKey: adapter.adapterKey, reasonCode: "risk_policy_denied", message: `Execution denied by risk policy (policy: ${riskPolicy}, risk: ${riskLevel})`, checks };
  }
  if (riskLevel === "high" && (riskPolicy === "low_only" || riskPolicy === "medium_or_lower")) {
    checks.push({ key: "risk_policy", passed: false, message: `Risk level "high" exceeds policy "${riskPolicy}"` });
    return { eligible: false, adapterKey: adapter.adapterKey, reasonCode: "risk_policy_denied", message: `Risk level "high" is not permitted by policy "${riskPolicy}"`, checks };
  }
  if (riskLevel === "medium" && riskPolicy === "low_only") {
    checks.push({ key: "risk_policy", passed: false, message: `Risk level "medium" exceeds policy "low_only"` });
    return { eligible: false, adapterKey: adapter.adapterKey, reasonCode: "risk_policy_denied", message: `Risk level "medium" is not permitted by policy "low_only"`, checks };
  }

  // 9. Approval required for high risk
  if (riskLevel === "high" && riskPolicy === "high_with_approval") {
    if (!executionRequest.requiresApproval || !executionRequest.approvalRequestId) {
      checks.push({ key: "approval_required", passed: false, message: "High risk execution requires approval but no approval is on file" });
      return { eligible: false, adapterKey: adapter.adapterKey, reasonCode: "approval_required", message: "High risk execution requires an approval request", checks };
    }
  }
  checks.push({ key: "risk_policy", passed: true, message: `Risk level "${riskLevel}" is permitted by policy "${riskPolicy}"` });

  // 10. External side effects disabled
  if (adapter.externalSideEffectsEnabled) {
    checks.push({ key: "external_side_effects", passed: false, message: "Adapter has external side effects enabled, which is not permitted" });
    return { eligible: false, adapterKey: adapter.adapterKey, reasonCode: "external_side_effects_disabled", message: "Adapter has external side effects enabled", checks };
  }
  checks.push({ key: "external_side_effects", passed: true, message: "External side effects are disabled" });

  return {
    eligible: true,
    adapterKey: adapter.adapterKey,
    reasonCode: "eligible",
    message: "Adapter is eligible for execution",
    checks,
  };
}
