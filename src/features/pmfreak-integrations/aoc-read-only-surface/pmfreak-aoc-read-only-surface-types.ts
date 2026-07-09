// PMFreak AOC Read-Only Integration Surface v1 — surface-level types
//
// These types describe the integration surface boundary itself
// (descriptor, config, snapshot, health, error). Domain read models
// (project/agent/milestone/task/risk/evidence/approval/action proposal)
// live in pmfreak-read-models.ts. The read-only source interface lives in
// pmfreak-aoc-read-only-source.ts.

export type PMFreakAocReadOnlySurfaceDescriptor = {
  surfaceId: string;
  surfaceName: string;
  providerId: "pmfreak";
  consumerId: "aoc";
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

export type PMFreakAocReadOnlySurfaceEnvironment = "demo" | "development" | "staging" | "production";

export type PMFreakAocReadOnlySurfaceSourceKind = "in_memory" | "api" | "database" | "supabase" | "unknown";

export type PMFreakAocReadOnlySurfaceRedactionMode = "none" | "safe_demo" | "strict";

export type PMFreakAocReadOnlySurfaceConfig = {
  surfaceId: string;
  environment: PMFreakAocReadOnlySurfaceEnvironment;
  sourceKind: PMFreakAocReadOnlySurfaceSourceKind;

  baseUrl?: string;
  projectId?: string;
  tenantId?: string;
  workspaceId?: string;

  readOnly: true;
  allowMutations: false;

  timeoutMs?: number;
  maxRecords?: number;

  redactionMode: PMFreakAocReadOnlySurfaceRedactionMode;

  notes: string[];
  warnings: string[];
};

export type PMFreakAocSurfaceHealthStatus = "healthy" | "degraded" | "unavailable";

export type PMFreakAocSurfaceHealth = {
  surfaceId: string;
  sourceKind: PMFreakAocReadOnlySurfaceSourceKind;
  status: PMFreakAocSurfaceHealthStatus;
  readOnly: true;
  allowMutations: false;
  checkedCapabilities: string[];
  warnings: string[];
  errors: string[];
};

export type PMFreakAocSurfaceErrorCode =
  | "invalid_config"
  | "source_unavailable"
  | "read_failed"
  | "mutation_not_allowed"
  | "unsupported_source_kind"
  | "redaction_failed"
  | "unknown_error";

export type PMFreakAocSurfaceError = {
  code: PMFreakAocSurfaceErrorCode;
  message: string;
  safe: true;
  details?: Record<string, unknown>;
};
