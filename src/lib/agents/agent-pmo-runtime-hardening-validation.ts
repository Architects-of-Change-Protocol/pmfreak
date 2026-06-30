// ─── PMO End-to-End Governance Runtime Hardening — Validation ────────────────
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT execute adapters, activate policies, rollback policies, or complete handoffs.

import type {
  AgentPmoRuntimeHardeningRunRecord,
  AgentPmoGovernanceLayer,
  AgentPmoRuntimeHardeningScope,
  AgentPmoHardeningBlockerType,
  AgentPmoHardeningBlockerSeverity,
  AgentPmoRemediationItemType,
} from "./agent-pmo-runtime-hardening-types";

// ─── Known Governance Layers ──────────────────────────────────────────────────

export const ALL_GOVERNANCE_LAYERS: AgentPmoGovernanceLayer[] = [
  "execution_request_runtime",
  "tool_adapter_layer",
  "execution_results_evidence",
  "human_review_action_inbox",
  "action_conversion_approval_bridge",
  "dispatch_gate",
  "result_reconciliation",
  "learning_signals",
  "governance_dashboard",
  "policy_backlog",
  "approval_pack",
  "implementation_planning",
  "dry_run_gate",
  "policy_activation_rollback",
  "project_intelligence_handoff",
];

export const ALL_SCOPES: AgentPmoRuntimeHardeningScope[] = [
  "full_governance_runtime",
  "route_contracts",
  "database_contracts",
  "rls_policies",
  "workspace_isolation",
  "observability",
  "exports",
  "idempotency",
  "error_handling",
  "ui_dashboard",
  "ci_smoke",
  "production_readiness",
];

export const ALL_BLOCKER_TYPES: AgentPmoHardeningBlockerType[] = [
  "missing_layer_export",
  "missing_route_contract",
  "failing_typecheck",
  "failing_test",
  "failing_build",
  "rls_gap",
  "workspace_isolation_gap",
  "observability_gap",
  "export_safety_gap",
  "unsafe_error_handling",
  "idempotency_gap",
  "ui_action_safety_gap",
  "prohibited_behavior_detected",
  "terminology_violation",
  "unresolved_known_limitation",
  "unknown",
];

export const ALL_BLOCKER_SEVERITIES: AgentPmoHardeningBlockerSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const ALL_REMEDIATION_TYPES: AgentPmoRemediationItemType[] = [
  "code_fix",
  "test_fix",
  "docs_fix",
  "migration_fix",
  "route_fix",
  "export_safety_fix",
  "rls_policy_fix",
  "observability_fix",
  "ui_safety_fix",
  "known_limitation_documentation",
  "future_sprint_item",
];

// ─── Export Safety Blocked Fields ─────────────────────────────────────────────

export const EXPORT_BLOCKED_FIELD_PATTERNS = [
  "raw_payload",
  "raw_ci_log",
  "stack_trace",
  "password",
  "secret",
  "token",
  "credential",
  "api_key",
  "private_key",
  "correction_detail",
  "failure_detail",
];

export function validateExportSafety(content: string): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const pattern of EXPORT_BLOCKED_FIELD_PATTERNS) {
    if (content.toLowerCase().includes(pattern)) {
      violations.push(`Blocked field pattern detected: ${pattern}`);
    }
  }
  return { safe: violations.length === 0, violations };
}

// ─── Run Validation ───────────────────────────────────────────────────────────

export type HardeningRunCreateInput = {
  workspaceId: string;
  scope: AgentPmoRuntimeHardeningScope;
  triggeredBy?: string | null;
};

export function validateHardeningRunCreateInput(input: unknown): HardeningRunCreateInput {
  if (!input || typeof input !== "object") throw new Error("Input must be an object");
  const obj = input as Record<string, unknown>;
  if (!obj.workspaceId || typeof obj.workspaceId !== "string") {
    throw new Error("workspaceId is required");
  }
  if (!obj.scope || !ALL_SCOPES.includes(obj.scope as AgentPmoRuntimeHardeningScope)) {
    throw new Error(`scope must be one of: ${ALL_SCOPES.join(", ")}`);
  }
  return {
    workspaceId: obj.workspaceId,
    scope: obj.scope as AgentPmoRuntimeHardeningScope,
    triggeredBy: typeof obj.triggeredBy === "string" ? obj.triggeredBy : null,
  };
}

// ─── Blocker Validation ───────────────────────────────────────────────────────

export type BlockerCreateInput = {
  workspaceId: string;
  hardeningRunId: string;
  blockerType: AgentPmoHardeningBlockerType;
  severity: AgentPmoHardeningBlockerSeverity;
  title: string;
  description: string;
  affectedLayer?: AgentPmoGovernanceLayer | null;
  affectedFile?: string | null;
};

export function validateBlockerCreateInput(input: unknown): BlockerCreateInput {
  if (!input || typeof input !== "object") throw new Error("Input must be an object");
  const obj = input as Record<string, unknown>;
  if (!obj.workspaceId || typeof obj.workspaceId !== "string") throw new Error("workspaceId required");
  if (!obj.hardeningRunId || typeof obj.hardeningRunId !== "string") throw new Error("hardeningRunId required");
  if (!obj.blockerType || !ALL_BLOCKER_TYPES.includes(obj.blockerType as AgentPmoHardeningBlockerType)) {
    throw new Error(`blockerType must be one of: ${ALL_BLOCKER_TYPES.join(", ")}`);
  }
  if (!obj.severity || !ALL_BLOCKER_SEVERITIES.includes(obj.severity as AgentPmoHardeningBlockerSeverity)) {
    throw new Error(`severity must be one of: ${ALL_BLOCKER_SEVERITIES.join(", ")}`);
  }
  if (!obj.title || typeof obj.title !== "string") throw new Error("title required");
  if (!obj.description || typeof obj.description !== "string") throw new Error("description required");
  return {
    workspaceId: obj.workspaceId,
    hardeningRunId: obj.hardeningRunId,
    blockerType: obj.blockerType as AgentPmoHardeningBlockerType,
    severity: obj.severity as AgentPmoHardeningBlockerSeverity,
    title: obj.title,
    description: obj.description,
    affectedLayer: (obj.affectedLayer as AgentPmoGovernanceLayer | null) ?? null,
    affectedFile: typeof obj.affectedFile === "string" ? obj.affectedFile : null,
  };
}

// ─── Remediation Validation ───────────────────────────────────────────────────

export type RemediationCreateInput = {
  workspaceId: string;
  hardeningRunId: string;
  blockerId?: string | null;
  remediationType: AgentPmoRemediationItemType;
  title: string;
  description: string;
};

export function validateRemediationCreateInput(input: unknown): RemediationCreateInput {
  if (!input || typeof input !== "object") throw new Error("Input must be an object");
  const obj = input as Record<string, unknown>;
  if (!obj.workspaceId || typeof obj.workspaceId !== "string") throw new Error("workspaceId required");
  if (!obj.hardeningRunId || typeof obj.hardeningRunId !== "string") throw new Error("hardeningRunId required");
  if (!obj.remediationType || !ALL_REMEDIATION_TYPES.includes(obj.remediationType as AgentPmoRemediationItemType)) {
    throw new Error(`remediationType must be one of: ${ALL_REMEDIATION_TYPES.join(", ")}`);
  }
  if (!obj.title || typeof obj.title !== "string") throw new Error("title required");
  if (!obj.description || typeof obj.description !== "string") throw new Error("description required");
  return {
    workspaceId: obj.workspaceId,
    hardeningRunId: obj.hardeningRunId,
    blockerId: typeof obj.blockerId === "string" ? obj.blockerId : null,
    remediationType: obj.remediationType as AgentPmoRemediationItemType,
    title: obj.title,
    description: obj.description,
  };
}

// ─── Layer File Map ───────────────────────────────────────────────────────────

export const LAYER_FILE_MAP: Record<AgentPmoGovernanceLayer, {
  typeFile: string;
  validationFile: string | null;
  registryFile: string | null;
  serviceFile: string | null;
  docs: string;
  tests: string;
  migration: string | null;
}> = {
  execution_request_runtime: {
    typeFile: "src/lib/agents/agent-execution-request-runtime-types.ts",
    validationFile: null,
    registryFile: "src/lib/agents/agent-execution-request-runtime-registry.ts",
    serviceFile: "src/lib/agents/agent-execution-request-runtime-service.ts",
    docs: "docs/agent-execution-request-runtime.md",
    tests: "tests/agent-execution-request-runtime.test.mjs",
    migration: null,
  },
  tool_adapter_layer: {
    typeFile: "src/lib/agents/agent-tool-adapter-layer-types.ts",
    validationFile: null,
    registryFile: null,
    serviceFile: null,
    docs: "docs/agent-tool-adapter-layer.md",
    tests: "tests/agent-tool-adapter-layer.test.mjs",
    migration: null,
  },
  execution_results_evidence: {
    typeFile: "src/lib/agents/agent-execution-results-evidence-types.ts",
    validationFile: null,
    registryFile: null,
    serviceFile: null,
    docs: "docs/agent-execution-results-evidence.md",
    tests: "tests/agent-execution-results-evidence.test.mjs",
    migration: null,
  },
  human_review_action_inbox: {
    typeFile: "src/lib/agents/agent-human-review-action-inbox-types.ts",
    validationFile: null,
    registryFile: null,
    serviceFile: null,
    docs: "docs/agent-human-review-action-inbox.md",
    tests: "tests/agent-human-review-action-inbox.test.mjs",
    migration: null,
  },
  action_conversion_approval_bridge: {
    typeFile: "src/lib/agents/agent-action-conversion-approval-bridge-types.ts",
    validationFile: null,
    registryFile: null,
    serviceFile: null,
    docs: "docs/agent-action-conversion-approval-bridge.md",
    tests: "tests/agent-action-conversion-approval-bridge.test.mjs",
    migration: null,
  },
  dispatch_gate: {
    typeFile: "src/lib/agents/agent-dispatch-gate-types.ts",
    validationFile: null,
    registryFile: null,
    serviceFile: null,
    docs: "docs/agent-dispatch-gate.md",
    tests: "tests/agent-dispatch-gate.test.mjs",
    migration: null,
  },
  result_reconciliation: {
    typeFile: "src/lib/agents/agent-result-reconciliation-types.ts",
    validationFile: null,
    registryFile: null,
    serviceFile: null,
    docs: "docs/agent-result-reconciliation.md",
    tests: "tests/agent-result-reconciliation.test.mjs",
    migration: null,
  },
  learning_signals: {
    typeFile: "src/lib/agents/agent-learning-signals-types.ts",
    validationFile: null,
    registryFile: null,
    serviceFile: null,
    docs: "docs/agent-learning-signals.md",
    tests: "tests/agent-learning-signals.test.mjs",
    migration: null,
  },
  governance_dashboard: {
    typeFile: "src/lib/agents/agent-pmo-governance-dashboard-types.ts",
    validationFile: null,
    registryFile: "src/lib/agents/agent-pmo-governance-dashboard-registry.ts",
    serviceFile: "src/lib/agents/agent-pmo-governance-dashboard-service.ts",
    docs: "docs/agent-pmo-governance-dashboard.md",
    tests: "tests/agent-pmo-governance-dashboard.test.mjs",
    migration: null,
  },
  policy_backlog: {
    typeFile: "src/lib/agents/agent-pmo-policy-backlog-types.ts",
    validationFile: "src/lib/agents/agent-pmo-policy-backlog-validation.ts",
    registryFile: "src/lib/agents/agent-pmo-policy-backlog-registry.ts",
    serviceFile: "src/lib/agents/agent-pmo-policy-backlog-service.ts",
    docs: "docs/agent-pmo-governance-proposal-review-controlled-policy-change-backlog.md",
    tests: "tests/agent-pmo-governance-proposal-review-controlled-policy-change-backlog.test.mjs",
    migration: null,
  },
  approval_pack: {
    typeFile: "src/lib/agents/agent-pmo-approval-pack-types.ts",
    validationFile: "src/lib/agents/agent-pmo-approval-pack-validation.ts",
    registryFile: "src/lib/agents/agent-pmo-approval-pack-registry.ts",
    serviceFile: "src/lib/agents/agent-pmo-approval-pack-service.ts",
    docs: "docs/agent-controlled-governance-policy-simulation-report-pmo-approval-pack.md",
    tests: "tests/agent-controlled-governance-policy-simulation-report-pmo-approval-pack.test.mjs",
    migration: null,
  },
  implementation_planning: {
    typeFile: "src/lib/agents/agent-pmo-implementation-planning-types.ts",
    validationFile: "src/lib/agents/agent-pmo-implementation-planning-validation.ts",
    registryFile: "src/lib/agents/agent-pmo-implementation-planning-registry.ts",
    serviceFile: "src/lib/agents/agent-pmo-implementation-planning-service.ts",
    docs: "docs/agent-controlled-policy-implementation-planning-workspace.md",
    tests: "tests/agent-controlled-policy-implementation-planning-workspace.test.mjs",
    migration: null,
  },
  dry_run_gate: {
    typeFile: "src/lib/agents/agent-pmo-dry-run-gate-types.ts",
    validationFile: "src/lib/agents/agent-pmo-dry-run-gate-validation.ts",
    registryFile: "src/lib/agents/agent-pmo-dry-run-gate-registry.ts",
    serviceFile: "src/lib/agents/agent-pmo-dry-run-gate-service.ts",
    docs: "docs/agent-controlled-policy-implementation-gate-dry-run-change-executor.md",
    tests: "tests/agent-controlled-policy-implementation-gate-dry-run-change-executor.test.mjs",
    migration: null,
  },
  policy_activation_rollback: {
    typeFile: "src/lib/agents/agent-pmo-policy-activation-types.ts",
    validationFile: "src/lib/agents/agent-pmo-policy-activation-validation.ts",
    registryFile: "src/lib/agents/agent-pmo-policy-activation-registry.ts",
    serviceFile: "src/lib/agents/agent-pmo-policy-activation-service.ts",
    docs: "docs/agent-controlled-policy-version-activation-rollback-gate.md",
    tests: "tests/agent-controlled-policy-version-activation-rollback-gate.test.mjs",
    migration: null,
  },
  project_intelligence_handoff: {
    typeFile: "src/lib/agents/agent-pmo-project-handoff-types.ts",
    validationFile: "src/lib/agents/agent-pmo-project-handoff-validation.ts",
    registryFile: "src/lib/agents/agent-pmo-project-handoff-registry.ts",
    serviceFile: "src/lib/agents/agent-pmo-project-handoff-service.ts",
    docs: "docs/agent-controlled-project-intelligence-handoff.md",
    tests: "tests/agent-controlled-project-intelligence-handoff.test.mjs",
    migration: "supabase/migrations/20260813000000_agent_controlled_project_intelligence_handoff.sql",
  },
};
