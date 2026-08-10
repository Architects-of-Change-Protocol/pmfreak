import {
  LEGACY_REFERENCE_KINDS,
  parseCanonicalId,
  type CanonicalObjectKind,
  type CanonicalReference,
  type LegacyReference,
} from "./contracts";

export const COMPATIBILITY_CONTRACT_VERSION = "p2-02.v1" as const;

export const SUPPORTED_LEGACY_MAPPINGS = {
  operational_recommendation: "recommendation",
  recommended_action: "recommendation",
  operational_decision_record: "decision",
  project_decision: "decision",
  task_draft: "task",
  execution_task: "task",
  agent_decision: "decision",
  agent_execution_outcome: "outcome",
  operational_decision_outcome: "outcome",
} as const satisfies Partial<Record<LegacyReference["kind"], CanonicalObjectKind>>;

export type CompatibilityEvidence = Readonly<{
  reference: string;
  basis: "persisted_link" | "verified_identity" | "versioned_event";
}>;

export type CompatibilityMapping = Readonly<{
  canonicalReference: CanonicalReference;
  legacyReference: LegacyReference;
  owner: string;
  method: "persisted_link" | "identity_projection" | "event_projection";
  contractVersion: typeof COMPATIBILITY_CONTRACT_VERSION;
  evidence: readonly CompatibilityEvidence[];
}>;

export type CompatibilityFailureCode =
  | "invalid_reference"
  | "unsupported_reference_kind"
  | "unresolved_reference"
  | "scope_mismatch"
  | "duplicate_mapping"
  | "conflicting_canonical_ownership"
  | "stale_contract_version"
  | "unavailable_dependency";

export type CompatibilityResolution =
  | Readonly<{ status: "resolved"; mapping: CompatibilityMapping }>
  | Readonly<{ status: "failed"; code: CompatibilityFailureCode; legacyReference: LegacyReference; detail: string; retryable: boolean }>;

export type CompatibilityScope = Readonly<{ workspaceId: string; projectId: string | null }>;
export type CompatibilityMappingReader = (reference: LegacyReference) =>
  | readonly CompatibilityMapping[]
  | Readonly<{ unavailable: true }>;

function failure(reference: LegacyReference, code: CompatibilityFailureCode, detail: string, retryable = false): CompatibilityResolution {
  return { status: "failed", code, legacyReference: reference, detail, retryable };
}

/** Pure, read-only resolution. The caller supplies already-authorized mapping candidates. */
export function resolveLegacyReference(input: Readonly<{
  reference: LegacyReference;
  scope: CompatibilityScope;
  contractVersion: string;
  readMappings: CompatibilityMappingReader;
}>): CompatibilityResolution {
  const { reference } = input;
  if (!LEGACY_REFERENCE_KINDS.includes(reference.kind) || !reference.id.trim() || !reference.workspaceId.trim()) {
    return failure(reference, "invalid_reference", "Legacy kind, id, and Workspace are required.");
  }
  if (!(reference.kind in SUPPORTED_LEGACY_MAPPINGS)) {
    return failure(reference, "unsupported_reference_kind", `No P2-02 adapter supports ${reference.kind}.`);
  }
  if (input.contractVersion !== COMPATIBILITY_CONTRACT_VERSION) {
    return failure(reference, "stale_contract_version", "The compatibility contract version is stale.");
  }
  if (reference.workspaceId !== input.scope.workspaceId || reference.projectId !== input.scope.projectId) {
    return failure(reference, "scope_mismatch", "Workspace or Project scope does not match the authorized scope.");
  }
  const candidates = input.readMappings(reference);
  if ("unavailable" in candidates) return failure(reference, "unavailable_dependency", "Mapping dependency is unavailable.", true);
  if (candidates.length === 0) return failure(reference, "unresolved_reference", "No verified canonical mapping exists.");
  if (candidates.length > 1) {
    const owners = new Set(candidates.map((candidate) => `${candidate.owner}:${candidate.canonicalReference.kind}:${candidate.canonicalReference.id}`));
    return failure(reference, owners.size > 1 ? "conflicting_canonical_ownership" : "duplicate_mapping", "Mapping is ambiguous and cannot be resolved optimistically.");
  }
  const mapping = candidates[0];
  const expectedKind = SUPPORTED_LEGACY_MAPPINGS[reference.kind as keyof typeof SUPPORTED_LEGACY_MAPPINGS];
  const parsedId = parseCanonicalId(mapping.canonicalReference.kind, mapping.canonicalReference.id);
  if (!parsedId.ok || mapping.canonicalReference.kind !== expectedKind || mapping.legacyReference.kind !== reference.kind || mapping.legacyReference.id !== reference.id) {
    return failure(reference, "conflicting_canonical_ownership", "Mapping identity or canonical ownership conflicts with the adapter contract.");
  }
  if (mapping.contractVersion !== COMPATIBILITY_CONTRACT_VERSION) {
    return failure(reference, "stale_contract_version", "The stored mapping uses a stale compatibility contract.");
  }
  if (mapping.canonicalReference.workspaceId !== input.scope.workspaceId || mapping.canonicalReference.projectId !== input.scope.projectId) {
    return failure(reference, "scope_mismatch", "Mapped canonical reference crosses Workspace or Project scope.");
  }
  return { status: "resolved", mapping };
}

export type CorrelationSpine = Readonly<{
  actor: Readonly<{ id: string; type: "user" | "agent" | "system" }>;
  evaluatedAt: string;
  occurredAt: string;
  recordedAt: string;
  correlationId: string | null;
  causationId: string | null;
  evidenceReferences: readonly string[];
  confidence: "low" | "medium" | "high" | "unavailable";
  missingData: readonly ("correlation" | "causation" | "evidence" | "authority")[];
  authority: Readonly<{ businessAuthority: string | null; aocPolicyReference: string | null; aocGrantReference: string | null }>;
  sourceReferences: readonly string[];
  legacyReferences: readonly LegacyReference[];
  correctionOf: string | null;
  supersedes: string | null;
}>;

export type LineageValidationResult = Readonly<{ ok: true; partial: boolean }> | Readonly<{ ok: false; code: "cyclic_lineage" | "ambiguous_lineage"; detail: string }>;

export function validateLineageEdges(edges: readonly Readonly<{ id: string; causationId: string | null }>[]): LineageValidationResult {
  const ids = new Set<string>();
  for (const edge of edges) {
    if (ids.has(edge.id)) return { ok: false, code: "ambiguous_lineage", detail: `Duplicate lineage id: ${edge.id}` };
    ids.add(edge.id);
  }
  const byId = new Map(edges.map((edge) => [edge.id, edge.causationId]));
  for (const edge of edges) {
    const visited = new Set<string>();
    let current: string | null = edge.id;
    while (current && byId.has(current)) {
      if (visited.has(current)) return { ok: false, code: "cyclic_lineage", detail: `Cycle includes: ${current}` };
      visited.add(current);
      current = byId.get(current) ?? null;
    }
  }
  return { ok: true, partial: edges.some((edge) => edge.causationId === null || !ids.has(edge.causationId)) };
}

export type CompatibilityEvent = Readonly<{
  eventType: string;
  eventVersion: string;
  actor: CorrelationSpine["actor"];
  workspaceId: string;
  projectId: string;
  occurredAt: string;
  recordedAt: string;
  correlationId: string | null;
  causationId: string | null;
  canonicalReference: CanonicalReference | null;
  legacyReference: LegacyReference;
  owner: string;
  evidenceReferences: readonly string[];
  compatibilityContractVersion: typeof COMPATIBILITY_CONTRACT_VERSION;
  lineageStatus: "complete" | "partial" | "unresolved";
}>;

export function mapCompatibilityEvent(input: Readonly<{
  eventType: string; eventVersion: string; spine: CorrelationSpine; resolution: CompatibilityResolution; legacyReference: LegacyReference; owner: string;
}>): CompatibilityEvent {
  const canonicalReference = input.resolution.status === "resolved" ? input.resolution.mapping.canonicalReference : null;
  return {
    eventType: input.eventType, eventVersion: input.eventVersion, actor: input.spine.actor,
    workspaceId: input.legacyReference.workspaceId, projectId: input.legacyReference.projectId ?? "",
    occurredAt: input.spine.occurredAt, recordedAt: input.spine.recordedAt,
    correlationId: input.spine.correlationId, causationId: input.spine.causationId,
    canonicalReference, legacyReference: input.legacyReference, owner: input.owner,
    evidenceReferences: input.spine.evidenceReferences,
    compatibilityContractVersion: COMPATIBILITY_CONTRACT_VERSION,
    lineageStatus: canonicalReference === null ? "unresolved" : input.spine.missingData.length > 0 ? "partial" : "complete",
  };
}
