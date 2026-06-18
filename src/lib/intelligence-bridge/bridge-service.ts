import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveIntelligenceBridgeSources } from "./source-resolver";
import type {
  ALLOWED_BRIDGE_STATUSES,
  BridgeResult,
  IntelligenceBridgeExplanation,
  IntelligenceBridgeExport,
  IntelligenceBridgeHealth,
  IntelligenceBridgeLineage,
  IntelligenceBridgeObservation,
  IntelligenceBridgeOrganizationalSourceType,
  IntelligenceBridgePersonalSourceType,
  IntelligenceBridgeRecord,
  IntelligenceBridgeRelationshipType,
  IntelligenceBridgeSource,
  IntelligenceBridgeStatus,
  IntelligenceBridgeTimelineEvent,
} from "./types";
import {
  ALLOWED_ORGANIZATIONAL_SOURCE_TYPES,
  ALLOWED_PERSONAL_SOURCE_TYPES,
  ALLOWED_RELATIONSHIP_TYPES,
} from "./types";

// ─── Internal helpers ─────────────────────────────────────────────────────────

function validUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
function required(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function validation<T>(error: string): BridgeResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}
function failed<T>(error: string, failureClass = "persistence_failed"): BridgeResult<T> {
  return { ok: false, error, failureClass };
}
function notFound<T>(): BridgeResult<T> {
  return { ok: false, error: "Not found.", failureClass: "not_found" };
}

const BRIDGE_COLUMNS =
  "id,workspace_id,pm_user_id,relationship_type,status,personal_source_type,personal_source_id," +
  "organizational_source_type,organizational_source_id,summary,created_at,updated_at,created_by,metadata";

const OBS_COLUMNS = "id,bridge_id,observation_summary,recorded_at,recorded_by,metadata";
const SRC_COLUMNS = "id,bridge_id,source_type,source_id,relationship_type,created_at";

async function emitBridgeEvent(
  bridge: IntelligenceBridgeRecord,
  eventType: string,
  actorId: string | null | undefined,
  correlationId?: string | null,
  causationId?: string | null
): Promise<BridgeResult<IntelligenceBridgeRecord>> {
  const event = await createPlatformEvent({
    workspaceId: bridge.workspace_id,
    actorId: actorId ?? bridge.created_by,
    actorType: (actorId ?? bridge.created_by) ? "user" : "system",
    eventType,
    eventCategory: "governance",
    source: (actorId ?? bridge.created_by) ? "user_action" : "system",
    correlationId: correlationId ?? bridge.id,
    causationId: causationId ?? null,
    rawReferenceTable: "intelligence_bridge_links",
    rawReferenceId: bridge.id,
    learningEligible: false,
    visibility: "personal",
    sensitivityLevel: "confidential",
    eventPayload: {
      bridgeId: bridge.id,
      relationshipType: bridge.relationship_type,
      status: bridge.status,
      pmUserId: bridge.pm_user_id,
    },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: bridge };
}

async function fetchBridge(
  bridgeId: string,
  pmUserId: string
): Promise<BridgeResult<IntelligenceBridgeRecord>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("intelligence_bridge_links")
    .select(BRIDGE_COLUMNS)
    .eq("id", bridgeId)
    .eq("pm_user_id", pmUserId)
    .single<IntelligenceBridgeRecord>();
  if (error || !data) return notFound();
  return { ok: true, data };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createIntelligenceBridge(input: {
  workspaceId: string;
  pmUserId: string;
  actorId: string;
  relationshipType: IntelligenceBridgeRelationshipType;
  personalSourceType: IntelligenceBridgePersonalSourceType;
  personalSourceId: string;
  organizationalSourceType: IntelligenceBridgeOrganizationalSourceType;
  organizationalSourceId: string;
  summary: string;
  metadata?: Record<string, unknown>;
  correlationId?: string | null;
  causationId?: string | null;
}): Promise<BridgeResult<IntelligenceBridgeRecord>> {
  if (!validUuid(input.workspaceId))            return validation("workspaceId must be a UUID.");
  if (!validUuid(input.pmUserId))               return validation("pmUserId must be a UUID.");
  if (!validUuid(input.actorId))                return validation("actorId must be a UUID.");
  if (!validUuid(input.personalSourceId))       return validation("personalSourceId must be a UUID.");
  if (!validUuid(input.organizationalSourceId)) return validation("organizationalSourceId must be a UUID.");
  if (!required(input.summary))                 return validation("summary is required.");
  if (!ALLOWED_RELATIONSHIP_TYPES.includes(input.relationshipType))
    return validation(`relationshipType must be one of: ${ALLOWED_RELATIONSHIP_TYPES.join(", ")}.`);
  if (!ALLOWED_PERSONAL_SOURCE_TYPES.includes(input.personalSourceType))
    return validation(`personalSourceType must be one of: ${ALLOWED_PERSONAL_SOURCE_TYPES.join(", ")}.`);
  if (!ALLOWED_ORGANIZATIONAL_SOURCE_TYPES.includes(input.organizationalSourceType))
    return validation(`organizationalSourceType must be one of: ${ALLOWED_ORGANIZATIONAL_SOURCE_TYPES.join(", ")}.`);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("intelligence_bridge_links")
    .insert({
      workspace_id:               input.workspaceId,
      pm_user_id:                 input.pmUserId,
      relationship_type:          input.relationshipType,
      status:                     "active",
      personal_source_type:       input.personalSourceType,
      personal_source_id:         input.personalSourceId,
      organizational_source_type: input.organizationalSourceType,
      organizational_source_id:   input.organizationalSourceId,
      summary:                    input.summary.trim(),
      created_by:                 input.actorId,
      metadata:                   input.metadata ?? {},
    })
    .select(BRIDGE_COLUMNS)
    .single<IntelligenceBridgeRecord>();
  if (error || !data) return failed("Unable to create intelligence bridge.");
  return emitBridgeEvent(data, "INTELLIGENCE_BRIDGE_CREATED", input.actorId, input.correlationId, input.causationId);
}

export async function getIntelligenceBridge(
  bridgeId: string,
  pmUserId: string
): Promise<BridgeResult<IntelligenceBridgeRecord>> {
  if (!validUuid(bridgeId))  return notFound();
  if (!validUuid(pmUserId))  return notFound();
  return fetchBridge(bridgeId, pmUserId);
}

export async function listIntelligenceBridges(
  workspaceId: string,
  pmUserId: string,
  options?: { status?: IntelligenceBridgeStatus }
): Promise<BridgeResult<IntelligenceBridgeRecord[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(pmUserId))    return validation("pmUserId must be a UUID.");
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("intelligence_bridge_links")
    .select(BRIDGE_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("pm_user_id", pmUserId)
    .order("updated_at", { ascending: false });
  if (options?.status) q = q.eq("status", options.status);
  const { data, error } = await q.returns<IntelligenceBridgeRecord[]>();
  if (error || !data) return failed("Unable to list intelligence bridges.");
  return { ok: true, data };
}

export async function updateIntelligenceBridge(
  bridgeId: string,
  pmUserId: string,
  actorId: string,
  updates: {
    summary?: string;
    metadata?: Record<string, unknown>;
    relationshipType?: IntelligenceBridgeRelationshipType;
  },
  correlationId?: string | null,
  causationId?: string | null
): Promise<BridgeResult<IntelligenceBridgeRecord>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const current = await fetchBridge(bridgeId, pmUserId);
  if (!current.ok) return current;
  if (current.data.status === "frozen")
    return failed("Frozen intelligence bridges cannot be edited; archive them instead.", "governance_violation");

  const patch: Record<string, unknown> = {};
  if (updates.summary !== undefined) {
    if (!required(updates.summary)) return validation("summary cannot be empty.");
    patch["summary"] = updates.summary.trim();
  }
  if (updates.metadata !== undefined) patch["metadata"] = updates.metadata;
  if (updates.relationshipType !== undefined) {
    if (!ALLOWED_RELATIONSHIP_TYPES.includes(updates.relationshipType))
      return validation(`relationshipType must be one of: ${ALLOWED_RELATIONSHIP_TYPES.join(", ")}.`);
    patch["relationship_type"] = updates.relationshipType;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("intelligence_bridge_links")
    .update(patch)
    .eq("id", bridgeId)
    .select(BRIDGE_COLUMNS)
    .single<IntelligenceBridgeRecord>();
  if (error || !data) return failed("Unable to update intelligence bridge.");
  return emitBridgeEvent(data, "INTELLIGENCE_BRIDGE_UPDATED", actorId, correlationId, causationId);
}

async function setBridgeStatus(
  bridgeId: string,
  pmUserId: string,
  actorId: string,
  status: IntelligenceBridgeStatus,
  eventType: string,
  correlationId?: string | null,
  causationId?: string | null
): Promise<BridgeResult<IntelligenceBridgeRecord>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const current = await fetchBridge(bridgeId, pmUserId);
  if (!current.ok) return current;
  if (current.data.status === "frozen" && status !== "archived")
    return failed("Frozen intelligence bridges can only be archived.", "governance_violation");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("intelligence_bridge_links")
    .update({ status })
    .eq("id", bridgeId)
    .select(BRIDGE_COLUMNS)
    .single<IntelligenceBridgeRecord>();
  if (error || !data) return failed(`Unable to ${status} intelligence bridge.`);
  return emitBridgeEvent(data, eventType, actorId, correlationId, causationId);
}

export const archiveIntelligenceBridge = (
  bridgeId: string, pmUserId: string, actorId: string,
  correlationId?: string | null, causationId?: string | null
) => setBridgeStatus(bridgeId, pmUserId, actorId, "archived", "INTELLIGENCE_BRIDGE_ARCHIVED", correlationId, causationId);

export const freezeIntelligenceBridge = (
  bridgeId: string, pmUserId: string, actorId: string,
  correlationId?: string | null, causationId?: string | null
) => setBridgeStatus(bridgeId, pmUserId, actorId, "frozen", "INTELLIGENCE_BRIDGE_FROZEN", correlationId, causationId);

export const deprecateIntelligenceBridge = (
  bridgeId: string, pmUserId: string, actorId: string,
  correlationId?: string | null, causationId?: string | null
) => setBridgeStatus(bridgeId, pmUserId, actorId, "deprecated", "INTELLIGENCE_BRIDGE_DEPRECATED", correlationId, causationId);

export async function deleteIntelligenceBridge(
  bridgeId: string,
  pmUserId: string,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null
): Promise<BridgeResult<{ id: string }>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const current = await fetchBridge(bridgeId, pmUserId);
  if (!current.ok) return current as BridgeResult<{ id: string }>;
  if (current.data.status === "frozen")
    return failed("Frozen intelligence bridges cannot be deleted; archive them instead.", "governance_violation");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("intelligence_bridge_links")
    .delete()
    .eq("id", bridgeId);
  if (error) return failed("Unable to delete intelligence bridge.");

  const emitted = await emitBridgeEvent(current.data, "INTELLIGENCE_BRIDGE_DELETED", actorId, correlationId, causationId);
  if (!emitted.ok) return emitted as BridgeResult<{ id: string }>;
  return { ok: true, data: { id: bridgeId } };
}

export async function recordIntelligenceBridgeObservation(
  bridgeId: string,
  pmUserId: string,
  actorId: string,
  observationSummary: string,
  metadata?: Record<string, unknown>,
  correlationId?: string | null,
  causationId?: string | null
): Promise<BridgeResult<IntelligenceBridgeObservation>> {
  if (!validUuid(actorId))             return validation("actorId must be a UUID.");
  if (!required(observationSummary))   return validation("observationSummary is required.");
  const bridge = await fetchBridge(bridgeId, pmUserId);
  if (!bridge.ok) return bridge as BridgeResult<IntelligenceBridgeObservation>;
  if (bridge.data.status === "frozen")
    return failed("Frozen intelligence bridge observations cannot be added; archive the bridge instead.", "governance_violation");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("intelligence_bridge_observations")
    .insert({
      bridge_id:           bridgeId,
      observation_summary: observationSummary.trim(),
      recorded_by:         actorId,
      metadata:            metadata ?? {},
    })
    .select(OBS_COLUMNS)
    .single<IntelligenceBridgeObservation>();
  if (error || !data) return failed("Unable to record observation.");

  const emitted = await emitBridgeEvent(bridge.data, "INTELLIGENCE_BRIDGE_OBSERVATION_RECORDED", actorId, correlationId, causationId);
  if (!emitted.ok) return emitted as BridgeResult<IntelligenceBridgeObservation>;
  return { ok: true, data };
}

async function fetchObservations(bridgeId: string): Promise<IntelligenceBridgeObservation[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("intelligence_bridge_observations")
    .select(OBS_COLUMNS)
    .eq("bridge_id", bridgeId)
    .order("recorded_at", { ascending: true })
    .returns<IntelligenceBridgeObservation[]>();
  return data ?? [];
}

async function fetchSources(bridgeId: string): Promise<IntelligenceBridgeSource[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("intelligence_bridge_sources")
    .select(SRC_COLUMNS)
    .eq("bridge_id", bridgeId)
    .order("created_at", { ascending: true })
    .returns<IntelligenceBridgeSource[]>();
  return data ?? [];
}

export async function explainIntelligenceBridge(
  bridgeId: string,
  pmUserId: string
): Promise<BridgeResult<IntelligenceBridgeExplanation>> {
  const bridge = await fetchBridge(bridgeId, pmUserId);
  if (!bridge.ok) return bridge as BridgeResult<IntelligenceBridgeExplanation>;

  const [observations, sources] = await Promise.all([
    fetchObservations(bridgeId),
    fetchSources(bridgeId),
  ]);

  const resolved = await resolveIntelligenceBridgeSources(bridge.data, sources);

  return {
    ok: true,
    data: {
      bridge: bridge.data,
      observations,
      sources,
      personalMemory:           resolved.personalMemory,
      personalPatterns:         resolved.personalPatterns,
      personalEffectiveness:    resolved.personalEffectiveness,
      personalPatternCandidates: resolved.personalPatternCandidates,
      organizationalMemory:     resolved.organizationalMemory,
      organizationalPatterns:   resolved.organizationalPatterns,
      decisionEffectiveness:    resolved.decisionEffectiveness,
      patternCandidates:        resolved.patternCandidates,
      events:                   resolved.events,
      decisions:                resolved.decisions,
      outcomes:                 resolved.outcomes,
      unresolvedSources:        resolved.unresolvedSources,
    },
  };
}

export async function buildIntelligenceBridgeLineage(
  bridgeId: string,
  pmUserId: string
): Promise<BridgeResult<IntelligenceBridgeLineage>> {
  const explanation = await explainIntelligenceBridge(bridgeId, pmUserId);
  if (!explanation.ok) return explanation as BridgeResult<IntelligenceBridgeLineage>;
  const { bridge, observations, sources, unresolvedSources } = explanation.data;

  // Build timeline
  const timeline: IntelligenceBridgeTimelineEvent[] = [];
  timeline.push({ occurredAt: bridge.created_at, eventType: "bridge_created",      description: "Bridge relationship created.",       referenceId: bridge.id });
  if (bridge.updated_at !== bridge.created_at)
    timeline.push({ occurredAt: bridge.updated_at, eventType: "bridge_updated",    description: "Bridge relationship updated.",       referenceId: bridge.id });
  for (const obs of observations)
    timeline.push({ occurredAt: obs.recorded_at,  eventType: "observation_recorded", description: obs.observation_summary,            referenceId: obs.id });
  for (const src of sources)
    timeline.push({ occurredAt: src.created_at,   eventType: "source_added",       description: `Source ${src.source_type} linked.`, referenceId: src.id });
  timeline.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  // Determine if primary sides resolved
  const allResolved = new Set([
    ...explanation.data.personalMemory,
    ...explanation.data.personalPatterns,
    ...explanation.data.personalEffectiveness,
    ...explanation.data.personalPatternCandidates,
  ].map((r) => (r as { id?: string }).id).filter(Boolean));

  const allOrgResolved = new Set([
    ...explanation.data.organizationalMemory,
    ...explanation.data.organizationalPatterns,
    ...explanation.data.decisionEffectiveness,
    ...explanation.data.patternCandidates,
    ...explanation.data.events,
    ...explanation.data.decisions,
    ...explanation.data.outcomes,
  ].map((r) => (r as { id?: string }).id).filter(Boolean));

  const personalRecord = [...explanation.data.personalMemory, ...explanation.data.personalPatterns,
    ...explanation.data.personalEffectiveness, ...explanation.data.personalPatternCandidates]
    .find((r) => (r as { id?: string }).id === bridge.personal_source_id) ?? null;

  const orgRecord = [...explanation.data.organizationalMemory, ...explanation.data.organizationalPatterns,
    ...explanation.data.decisionEffectiveness, ...explanation.data.patternCandidates,
    ...explanation.data.events, ...explanation.data.decisions, ...explanation.data.outcomes]
    .find((r) => (r as { id?: string }).id === bridge.organizational_source_id) ?? null;

  const supportingEvidence: Record<string, unknown>[] = [
    ...explanation.data.events,
    ...explanation.data.decisions,
    ...explanation.data.outcomes,
  ];

  return {
    ok: true,
    data: {
      bridge,
      observations,
      sources,
      personalSide: {
        sourceType: bridge.personal_source_type,
        sourceId:   bridge.personal_source_id,
        resolved:   allResolved.has(bridge.personal_source_id),
        record:     personalRecord as Record<string, unknown> | null,
      },
      organizationalSide: {
        sourceType: bridge.organizational_source_type,
        sourceId:   bridge.organizational_source_id,
        resolved:   allOrgResolved.has(bridge.organizational_source_id),
        record:     orgRecord as Record<string, unknown> | null,
      },
      supportingEvidence,
      unresolvedSources,
      timeline,
    },
  };
}

export async function exportIntelligenceBridge(
  bridgeId: string,
  pmUserId: string
): Promise<BridgeResult<IntelligenceBridgeExport>> {
  const lineage = await buildIntelligenceBridgeLineage(bridgeId, pmUserId);
  if (!lineage.ok) return lineage as BridgeResult<IntelligenceBridgeExport>;

  const observations = await fetchObservations(bridgeId);
  const sources      = await fetchSources(bridgeId);

  return {
    ok: true,
    data: {
      bridge:           lineage.data.bridge,
      observations,
      sources,
      lineage:          lineage.data,
      unresolvedSources: lineage.data.unresolvedSources,
      exportedAt:       new Date().toISOString(),
    },
  };
}

export async function getIntelligenceBridgeHealth(
  workspaceId: string,
  pmUserId: string
): Promise<BridgeResult<IntelligenceBridgeHealth>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(pmUserId))    return validation("pmUserId must be a UUID.");

  const bridges = await listIntelligenceBridges(workspaceId, pmUserId);
  if (!bridges.ok) return bridges as BridgeResult<IntelligenceBridgeHealth>;

  const total = bridges.data.length;
  const bridgeIds = bridges.data.map((b) => b.id);

  // Initialize relationship type counts to 0
  const relationshipTypeCounts = Object.fromEntries(
    ALLOWED_RELATIONSHIP_TYPES.map((t) => [t, 0])
  ) as Record<IntelligenceBridgeRelationshipType, number>;

  let activeCount = 0, archivedCount = 0, frozenCount = 0, deprecatedCount = 0;
  for (const b of bridges.data) {
    if (b.status === "active")     activeCount++;
    if (b.status === "archived")   archivedCount++;
    if (b.status === "frozen")     frozenCount++;
    if (b.status === "deprecated") deprecatedCount++;
    if (b.relationship_type in relationshipTypeCounts) {
      relationshipTypeCounts[b.relationship_type as IntelligenceBridgeRelationshipType]++;
    }
  }

  const supabase = await createSupabaseServerClient();

  const [obsResult, srcResult] = await Promise.all([
    bridgeIds.length
      ? supabase.from("intelligence_bridge_observations").select("bridge_id").in("bridge_id", bridgeIds).returns<{ bridge_id: string }[]>()
      : Promise.resolve({ data: [] as { bridge_id: string }[] }),
    bridgeIds.length
      ? supabase.from("intelligence_bridge_sources").select("bridge_id").in("bridge_id", bridgeIds).returns<{ bridge_id: string }[]>()
      : Promise.resolve({ data: [] as { bridge_id: string }[] }),
  ]);

  const observationCount = (obsResult.data ?? []).length;
  const bridgesWithSource = new Set((srcResult.data ?? []).map((s: { bridge_id: string }) => s.bridge_id)).size;
  const divisor = total || 1;

  return {
    ok: true,
    data: {
      activeCount,
      archivedCount,
      frozenCount,
      deprecatedCount,
      observationCount,
      sourceCoverage:    Math.min(1, Math.max(0, bridgesWithSource / divisor)),
      lineageCoverage:   Math.min(1, Math.max(0, bridgesWithSource / divisor)),
      relationshipTypeCounts,
    },
  };
}
