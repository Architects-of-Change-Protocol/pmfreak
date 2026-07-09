// AOC PMFreak Read-Only Connector v1 — connector-level types
//
// These types describe the connector boundary itself (descriptor, config,
// snapshot, health, error). Domain read models (project/agent/milestone/
// task/risk/evidence/approval/action proposal) live in pmfreak-read-models.ts.
// The read-only source interface lives in pmfreak-read-only-source.ts.

export type AocPMFreakReadOnlyConnectorDescriptor = {
  connectorId: string;
  connectorName: string;
  systemId: "pmfreak";
  version: "v1";
  mode: "read_only";
  demoCompatible: true;
  productionMutationCapable: false;
  governanceDecisionCapable: false;
  capabilities: string[];
  forbiddenOperations: string[];
  safeLabels: string[];
  disclaimers: string[];
};

export type AocPMFreakReadOnlyConnectorEnvironment = "demo" | "development" | "staging" | "production";

export type AocPMFreakReadOnlyConnectorSourceKind = "in_memory" | "api" | "database" | "supabase" | "unknown";

export type AocPMFreakReadOnlyConnectorRedactionMode = "none" | "safe_demo" | "strict";

export type AocPMFreakReadOnlyConnectorConfig = {
  connectorId: string;
  environment: AocPMFreakReadOnlyConnectorEnvironment;
  sourceKind: AocPMFreakReadOnlyConnectorSourceKind;

  baseUrl?: string;
  projectId?: string;
  tenantId?: string;
  workspaceId?: string;

  readOnly: true;
  allowMutations: false;

  timeoutMs?: number;
  maxRecords?: number;

  redactionMode: AocPMFreakReadOnlyConnectorRedactionMode;

  notes: string[];
  warnings: string[];
};

export type AocPMFreakConnectorHealthStatus = "healthy" | "degraded" | "unavailable";

export type AocPMFreakConnectorHealth = {
  connectorId: string;
  sourceKind: AocPMFreakReadOnlyConnectorSourceKind;
  status: AocPMFreakConnectorHealthStatus;
  readOnly: true;
  allowMutations: false;
  checkedCapabilities: string[];
  warnings: string[];
  errors: string[];
};

export type AocPMFreakConnectorErrorCode =
  | "invalid_config"
  | "source_unavailable"
  | "read_failed"
  | "mutation_not_allowed"
  | "unsupported_source_kind"
  | "redaction_failed"
  | "unknown_error";

export type AocPMFreakConnectorError = {
  code: AocPMFreakConnectorErrorCode;
  message: string;
  safe: true;
  details?: Record<string, unknown>;
};
