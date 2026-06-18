// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Context Engine
//
// Builds a ConstitutionalContextPackage for a specific operational context
// using only explicit constitutional knowledge relationships.
//
// No AI. No ML. No embeddings. No scoring. No ranking. No prediction.
// Every selected record is traceable to an explicit ID or explicit reference.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import { assembleConstitutionalKnowledge } from "@/lib/constitutional-intelligence";
import type { KnowledgeDomain, ConstitutionalContradiction } from "@/lib/constitutional-intelligence";
import { resolveContextFromSnapshot, CONTEXT_REFERENCE_FIELDS } from "./context-resolver";
import type {
  ConstitutionalContextRequest,
  ConstitutionalContextPackage,
  ConstitutionalContextExplanation,
  ConstitutionalContextExport,
  ConstitutionalContextResult,
  ConstitutionalTimelineEntry,
  ContextType,
} from "./types";
import { ALL_CONTEXT_TYPES } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function failed<T>(error: string, failureClass = "query_failed"): ConstitutionalContextResult<T> {
  return { ok: false, error, failureClass };
}

async function emitContextEvent(
  workspaceId: string,
  actorId: string | null,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  await createPlatformEvent({
    workspaceId,
    actorId,
    actorType: actorId ? "user" : "system",
    eventType,
    eventCategory: "governance",
    source: actorId ? "user_action" : "system",
    correlationId: null,
    causationId: null,
    rawReferenceTable: null,
    rawReferenceId: null,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: payload,
  });
}

// ─── Timeline builder ─────────────────────────────────────────────────────────
// Constructs a chronological timeline from selected records.
// Uses explicit timestamp fields — no inference.

function buildTimeline(
  memories: Record<string, unknown>[],
  patterns: Record<string, unknown>[],
  effectivenessRecords: Record<string, unknown>[],
  bridgeRelationships: Record<string, unknown>[]
): ConstitutionalTimelineEntry[] {
  const entries: ConstitutionalTimelineEntry[] = [];

  function addEntry(
    record: Record<string, unknown>,
    recordType: string,
    summaryField: string
  ) {
    const id = record["id"] as string | undefined;
    if (!id) return;

    const timestamp =
      (record["created_at"] as string | undefined) ??
      (record["occurred_at"] as string | undefined) ??
      (record["recorded_at"] as string | undefined) ??
      (record["updated_at"] as string | undefined);

    if (!timestamp) return;

    const summary =
      (record[summaryField] as string | undefined) ??
      (record["summary"] as string | undefined) ??
      (record["description"] as string | undefined) ??
      recordType;

    const source =
      (record["source"] as string | undefined) ??
      (record["source_type"] as string | undefined) ??
      "constitutional_knowledge";

    entries.push({ timestamp, recordType, recordId: id, summary, source });
  }

  for (const r of memories) {
    addEntry(r, "memory", "memory_content");
  }
  for (const r of patterns) {
    addEntry(r, "pattern", "pattern_description");
  }
  for (const r of effectivenessRecords) {
    addEntry(r, "effectiveness", "outcome_summary");
  }
  for (const r of bridgeRelationships) {
    addEntry(r, "bridge_relationship", "relationship_type");
  }

  entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return entries;
}

// ─── Contradiction filter ─────────────────────────────────────────────────────
// Only includes contradictions already detected by the Constitutional Intelligence Layer.
// Never creates new contradictions.

function filterContradictions(
  allContradictions: ConstitutionalContradiction[],
  selectedIds: Set<string>
): ConstitutionalContradiction[] {
  return allContradictions.filter(
    (c) => selectedIds.has(c.sourceAId) || selectedIds.has(c.sourceBId)
  );
}

// ─── Domain filter ────────────────────────────────────────────────────────────

function filterDomains(
  allDomains: { domain: KnowledgeDomain; evidenceCount: number }[],
  requestedDomains: KnowledgeDomain[]
): KnowledgeDomain[] {
  if (requestedDomains.length === 0) {
    return allDomains.filter((d) => d.evidenceCount > 0).map((d) => d.domain);
  }
  return requestedDomains;
}

// ─── buildConstitutionalContext ───────────────────────────────────────────────

export async function buildConstitutionalContext(
  request: ConstitutionalContextRequest,
  actorId: string | null = null
): Promise<ConstitutionalContextResult<ConstitutionalContextPackage>> {
  const { workspaceId, pmUserId, contextType, contextId, relatedIds, knowledgeDomains, maxResults } = request;

  if (!validUuid(workspaceId)) return failed("workspaceId must be a UUID.", "validation_failed");
  if (!validUuid(pmUserId))    return failed("pmUserId must be a UUID.", "validation_failed");
  if (!validUuid(contextId))   return failed("contextId must be a UUID.", "validation_failed");
  if (!ALL_CONTEXT_TYPES.includes(contextType)) return failed(`Unknown contextType: ${contextType}`, "validation_failed");

  const effectiveMax = maxResults > 0 ? maxResults : 100;

  const snapshot = await assembleConstitutionalKnowledge(workspaceId, pmUserId);

  const resolved = resolveContextFromSnapshot(
    snapshot,
    contextType,
    contextId,
    relatedIds,
    effectiveMax
  );

  const selectedIds = new Set(resolved.evidence.map((r) => r["id"] as string).filter(Boolean));
  const contradictions = filterContradictions(snapshot.contradictions, selectedIds);
  const timeline = buildTimeline(
    resolved.memories,
    resolved.patterns,
    resolved.effectivenessRecords,
    resolved.bridgeRelationships
  );
  const domains = filterDomains(snapshot.knowledgeDomains, knowledgeDomains);

  const pkg: ConstitutionalContextPackage = {
    workspaceId,
    pmUserId,
    contextType,
    contextId,
    generatedAt: new Date().toISOString(),
    memories: resolved.memories,
    patterns: resolved.patterns,
    effectivenessRecords: resolved.effectivenessRecords,
    bridgeRelationships: resolved.bridgeRelationships,
    contradictions,
    evidence: resolved.evidence,
    timeline,
    knowledgeDomains: domains,
  };

  await emitContextEvent(workspaceId, actorId, "CONTEXT_PACKAGE_GENERATED", {
    pmUserId,
    contextType,
    contextId,
    evidenceCount: resolved.evidence.length,
    contradictionCount: contradictions.length,
    timelineLength: timeline.length,
  });

  return { ok: true, data: pkg };
}

// ─── explainContextSelection ──────────────────────────────────────────────────

export async function explainContextSelection(
  request: ConstitutionalContextRequest,
  actorId: string | null = null
): Promise<ConstitutionalContextResult<ConstitutionalContextExplanation>> {
  const { workspaceId, pmUserId, contextType, contextId, relatedIds, maxResults } = request;

  if (!validUuid(workspaceId)) return failed("workspaceId must be a UUID.", "validation_failed");
  if (!validUuid(pmUserId))    return failed("pmUserId must be a UUID.", "validation_failed");
  if (!validUuid(contextId))   return failed("contextId must be a UUID.", "validation_failed");
  if (!ALL_CONTEXT_TYPES.includes(contextType)) return failed(`Unknown contextType: ${contextType}`, "validation_failed");

  const effectiveMax = maxResults > 0 ? maxResults : 100;
  const snapshot = await assembleConstitutionalKnowledge(workspaceId, pmUserId);
  const resolved = resolveContextFromSnapshot(snapshot, contextType, contextId, relatedIds, effectiveMax);

  const selectedRecords = resolved.evidence.map((r) => ({
    recordType: (r["_recordType"] as string | undefined) ?? "unknown",
    recordId: r["id"] as string,
  }));

  const sourceRelationships = resolved.bridgeRelationships.map((b) => ({
    fromType: (b["personal_source_type"] as string) ?? "personal",
    fromId:   (b["personal_source_id"] as string) ?? "",
    relationshipType: (b["relationship_type"] as string) ?? "related_to",
    toType:   (b["organizational_source_type"] as string) ?? "organizational",
    toId:     (b["organizational_source_id"] as string) ?? "",
  }));

  const lineage = resolved.bridgeRelationships.map((b) => ({
    recordType: "bridge_relationship",
    recordId:   b["id"] as string,
    relationship: b["relationship_type"] as string ?? "related_to",
    resolvedAt: (b["updated_at"] ?? b["created_at"] ?? new Date().toISOString()) as string,
  }));

  await emitContextEvent(workspaceId, actorId, "CONTEXT_PACKAGE_EXPLAINED", {
    pmUserId,
    contextType,
    contextId,
    selectedRecordCount: selectedRecords.length,
    selectionReasonCount: resolved.selectionReasons.length,
  });

  return {
    ok: true,
    data: {
      contextType,
      contextId,
      selectedRecords,
      selectionReasons: resolved.selectionReasons,
      sourceRelationships,
      lineage,
    },
  };
}

// ─── exportContextPackage ─────────────────────────────────────────────────────

export async function exportContextPackage(
  request: ConstitutionalContextRequest,
  actorId: string | null = null
): Promise<ConstitutionalContextResult<ConstitutionalContextExport>> {
  const { workspaceId, pmUserId, contextType, contextId } = request;

  if (!validUuid(workspaceId)) return failed("workspaceId must be a UUID.", "validation_failed");
  if (!validUuid(pmUserId))    return failed("pmUserId must be a UUID.", "validation_failed");
  if (!validUuid(contextId))   return failed("contextId must be a UUID.", "validation_failed");
  if (!ALL_CONTEXT_TYPES.includes(contextType)) return failed(`Unknown contextType: ${contextType}`, "validation_failed");

  const buildResult = await buildConstitutionalContext(request, null);
  if (!buildResult.ok) return buildResult;

  await emitContextEvent(workspaceId, actorId, "CONTEXT_PACKAGE_EXPORTED", {
    pmUserId,
    contextType,
    contextId,
    evidenceCount: buildResult.data.evidence.length,
  });

  return {
    ok: true,
    data: {
      package: buildResult.data,
      exportedAt: new Date().toISOString(),
      format: "json",
    },
  };
}
