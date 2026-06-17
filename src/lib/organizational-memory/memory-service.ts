import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveMemorySources } from "./source-resolver";
import type { MemoryCategory, MemoryConfidence, MemoryEntry, MemoryEventType, MemoryExport, MemoryExplanation, MemoryHealth, MemoryInspection, MemoryResult, MemoryScope, MemorySource, MemorySourceRelationship, MemorySourceType } from "./types";

const scopes: MemoryScope[] = ["workspace", "project", "team"];
const categories: MemoryCategory[] = ["risk_pattern", "decision_pattern", "stakeholder_pattern", "schedule_pattern", "delivery_pattern", "dependency_pattern", "resource_pattern", "governance_pattern", "execution_pattern", "other"];
const confidenceValues: MemoryConfidence[] = ["low", "medium", "high", "very_high"];
const sourceTypes: MemorySourceType[] = ["platform_event", "decision", "outcome", "risk", "task", "milestone", "dependency", "stakeholder", "recommendation"];
const sourceRelationships: MemorySourceRelationship[] = ["supports", "contradicts", "caused_by", "derived_from", "reviewed_during", "supersedes", "related_to"];
const memoryColumns = "id,workspace_id,project_id,memory_scope,memory_category,title,summary,confidence,status,created_at,updated_at,created_by,metadata";
const sourceColumns = "id,memory_id,source_type,source_id,relationship_type,created_at";

function validUuid(value: string | null | undefined): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value); }
function required(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function validation<T>(error: string): MemoryResult<T> { return { ok: false, error, failureClass: "validation_failed" }; }
function failed<T>(error: string, failureClass = "persistence_failed"): MemoryResult<T> { return { ok: false, error, failureClass }; }

async function emitMemoryEvent(memory: MemoryEntry, eventType: MemoryEventType, actorId: string | null | undefined, correlationId?: string | null, causationId?: string | null): Promise<MemoryResult<MemoryEntry>> {
  const event = await createPlatformEvent({
    workspaceId: memory.workspace_id,
    projectId: memory.project_id,
    actorId: actorId ?? memory.created_by,
    actorType: (actorId ?? memory.created_by) ? "user" : "system",
    eventType,
    eventCategory: "governance",
    source: (actorId ?? memory.created_by) ? "user_action" : "system",
    correlationId: correlationId ?? memory.id,
    causationId: causationId ?? null,
    rawReferenceTable: "organizational_memory",
    rawReferenceId: memory.id,
    learningEligible: false,
    eventPayload: { memoryId: memory.id, memoryScope: memory.memory_scope, memoryCategory: memory.memory_category, status: memory.status },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: memory };
}

function validateSources(sources: Array<{ sourceType: MemorySourceType; sourceId: string; relationshipType: MemorySourceRelationship }>): MemoryResult<true> {
  if (!sources.length) return validation("At least one source is required; every memory must point to evidence.");
  for (const source of sources) {
    if (!sourceTypes.includes(source.sourceType)) return validation(`sourceType must be one of: ${sourceTypes.join(", ")}.`);
    if (!validUuid(source.sourceId)) return validation("sourceId must be a UUID.");
    if (!sourceRelationships.includes(source.relationshipType)) return validation(`relationshipType must be one of: ${sourceRelationships.join(", ")}.`);
  }
  return { ok: true, data: true };
}

export async function createMemory(input: { workspaceId: string; projectId?: string | null; memoryScope: MemoryScope; memoryCategory: MemoryCategory; title: string; summary: string; confidence: MemoryConfidence; createdBy: string; metadata?: Record<string, unknown>; sources: Array<{ sourceType: MemorySourceType; sourceId: string; relationshipType: MemorySourceRelationship }>; correlationId?: string | null; causationId?: string | null; }): Promise<MemoryResult<MemoryEntry>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (input.projectId !== undefined && input.projectId !== null && !validUuid(input.projectId)) return validation("projectId must be a UUID.");
  if (!validUuid(input.createdBy)) return validation("createdBy must be a UUID.");
  if (!scopes.includes(input.memoryScope)) return validation(`memoryScope must be one of: ${scopes.join(", ")}.`);
  if (!categories.includes(input.memoryCategory)) return validation(`memoryCategory must be one of: ${categories.join(", ")}.`);
  if (!confidenceValues.includes(input.confidence)) return validation(`confidence must be one of: ${confidenceValues.join(", ")}.`);
  if (!required(input.title)) return validation("title is required.");
  if (!required(input.summary)) return validation("summary is required.");
  const sourceValidation = validateSources(input.sources);
  if (!sourceValidation.ok) return sourceValidation;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("organizational_memory").insert({ workspace_id: input.workspaceId, project_id: input.projectId ?? null, memory_scope: input.memoryScope, memory_category: input.memoryCategory, title: input.title.trim(), summary: input.summary.trim(), confidence: input.confidence, status: "active", created_by: input.createdBy, metadata: input.metadata ?? {} }).select(memoryColumns).single<MemoryEntry>();
  if (error || !data) return failed("Unable to create memory.");
  const { error: sourceError } = await supabase.from("organizational_memory_sources").insert(input.sources.map((s) => ({ memory_id: data.id, source_type: s.sourceType, source_id: s.sourceId, relationship_type: s.relationshipType })));
  if (sourceError) return failed("Unable to attach memory sources.");
  return emitMemoryEvent(data, "MEMORY_CREATED", input.createdBy, input.correlationId, input.causationId);
}

export async function getMemory(memoryId: string): Promise<MemoryResult<MemoryEntry>> {
  if (!validUuid(memoryId)) return validation("memoryId must be a UUID.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("organizational_memory").select(memoryColumns).eq("id", memoryId).single<MemoryEntry>();
  if (error || !data) return failed("Memory not found.", "not_found");
  return { ok: true, data };
}

export async function updateMemory(memoryId: string, input: { title?: string; summary?: string; confidence?: MemoryConfidence; metadata?: Record<string, unknown>; actorId: string; correlationId?: string | null; causationId?: string | null; }): Promise<MemoryResult<MemoryEntry>> {
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
  const current = await getMemory(memoryId);
  if (!current.ok) return current;
  if (current.data.status === "frozen") return failed("Frozen memories cannot be edited or mutated; archive them instead.", "governance_violation");
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) { if (!required(input.title)) return validation("title cannot be empty."); patch.title = input.title.trim(); }
  if (input.summary !== undefined) { if (!required(input.summary)) return validation("summary cannot be empty."); patch.summary = input.summary.trim(); }
  if (input.confidence !== undefined) { if (!confidenceValues.includes(input.confidence)) return validation(`confidence must be one of: ${confidenceValues.join(", ")}.`); patch.confidence = input.confidence; }
  if (input.metadata !== undefined) patch.metadata = input.metadata;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("organizational_memory").update(patch).eq("id", memoryId).select(memoryColumns).single<MemoryEntry>();
  if (error || !data) return failed("Unable to update memory.");
  return emitMemoryEvent(data, "MEMORY_UPDATED", input.actorId, input.correlationId, input.causationId);
}

async function setMemoryStatus(memoryId: string, status: "archived" | "frozen" | "deprecated", eventType: MemoryEventType, actorId: string, correlationId?: string | null, causationId?: string | null): Promise<MemoryResult<MemoryEntry>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const current = await getMemory(memoryId);
  if (!current.ok) return current;
  if (current.data.status === "frozen" && status !== "archived") return failed("Frozen memories can only be archived.", "governance_violation");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("organizational_memory").update({ status, updated_at: new Date().toISOString() }).eq("id", memoryId).select(memoryColumns).single<MemoryEntry>();
  if (error || !data) return failed(`Unable to ${status} memory.`);
  return emitMemoryEvent(data, eventType, actorId, correlationId, causationId);
}

export const archiveMemory = (memoryId: string, actorId: string, correlationId?: string | null, causationId?: string | null) => setMemoryStatus(memoryId, "archived", "MEMORY_ARCHIVED", actorId, correlationId, causationId);
export const freezeMemory = (memoryId: string, actorId: string, correlationId?: string | null, causationId?: string | null) => setMemoryStatus(memoryId, "frozen", "MEMORY_FROZEN", actorId, correlationId, causationId);
export const deprecateMemory = (memoryId: string, actorId: string, correlationId?: string | null, causationId?: string | null) => setMemoryStatus(memoryId, "deprecated", "MEMORY_DEPRECATED", actorId, correlationId, causationId);

export async function listWorkspaceMemory(workspaceId: string): Promise<MemoryResult<MemoryEntry[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("organizational_memory").select(memoryColumns).eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).returns<MemoryEntry[]>();
  if (error || !data) return failed("Unable to list workspace memory.");
  return { ok: true, data };
}

export async function listProjectMemory(projectId: string): Promise<MemoryResult<MemoryEntry[]>> {
  if (!validUuid(projectId)) return validation("projectId must be a UUID.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("organizational_memory").select(memoryColumns).eq("project_id", projectId).order("updated_at", { ascending: false }).returns<MemoryEntry[]>();
  if (error || !data) return failed("Unable to list project memory.");
  return { ok: true, data };
}

async function getSources(memoryId: string): Promise<MemoryResult<MemorySource[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("organizational_memory_sources").select(sourceColumns).eq("memory_id", memoryId).order("created_at", { ascending: true }).returns<MemorySource[]>();
  if (error || !data) return failed("Unable to load memory sources.");
  return { ok: true, data };
}

export async function explainMemory(memoryId: string): Promise<MemoryResult<MemoryExplanation>> {
  const memory = await getMemory(memoryId); if (!memory.ok) return memory as MemoryResult<MemoryExplanation>;
  const sources = await getSources(memoryId); if (!sources.ok) return sources as MemoryResult<MemoryExplanation>;
  const resolved = await resolveMemorySources(memory.data, sources.data);
  return { ok: true, data: { memory: memory.data, supportingEvidence: sources.data, supportingEvents: resolved.platformEvents, supportingDecisions: resolved.decisions, supportingOutcomes: resolved.outcomes, unresolvedSources: resolved.unresolvedSources } };
}

export async function inspectMemory(memoryId: string): Promise<MemoryResult<MemoryInspection>> {
  const explanation = await explainMemory(memoryId); if (!explanation.ok) return explanation as MemoryResult<MemoryInspection>;
  const timeline = [...explanation.data.supportingEvidence, ...explanation.data.supportingEvents].sort((a, b) => new Date((a as { occurred_at?: string; created_at: string }).occurred_at ?? a.created_at).getTime() - new Date((b as { occurred_at?: string; created_at: string }).occurred_at ?? b.created_at).getTime());
  return { ok: true, data: { memory: explanation.data.memory, lineage: explanation.data.supportingEvidence, confidence: explanation.data.memory.confidence, sources: explanation.data.supportingEvidence, unresolvedSources: explanation.data.unresolvedSources, timeline } };
}

export async function exportMemory(memoryId: string): Promise<MemoryResult<MemoryExport>> {
  const explanation = await explainMemory(memoryId); if (!explanation.ok) return explanation as MemoryResult<MemoryExport>;
  return { ok: true, data: { memory: explanation.data.memory, sources: explanation.data.supportingEvidence, events: explanation.data.supportingEvents, decisions: explanation.data.supportingDecisions, outcomes: explanation.data.supportingOutcomes, lineage: explanation.data.supportingEvidence, unresolvedSources: explanation.data.unresolvedSources } };
}

export async function deleteMemory(memoryId: string, actorId: string, correlationId?: string | null, causationId?: string | null): Promise<MemoryResult<{ id: string }>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const current = await getMemory(memoryId); if (!current.ok) return current as MemoryResult<{ id: string }>;
  if (current.data.status === "frozen") return failed("Frozen memories cannot be deleted; archive them instead.", "governance_violation");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("organizational_memory").delete().eq("id", memoryId);
  if (error) return failed("Unable to delete memory.");
  const emitted = await emitMemoryEvent(current.data, "MEMORY_DELETED", actorId, correlationId, causationId);
  if (!emitted.ok) return emitted as MemoryResult<{ id: string }>;
  return { ok: true, data: { id: memoryId } };
}

export function computeMemoryHealthSnapshot(memories: MemoryEntry[], sources: MemorySource[]): MemoryHealth {
  const totalMemories = memories.length;
  const sourceMemoryIds = new Set(sources.map((source) => source.memory_id));
  const validLineageMemoryIds = new Set(sources.filter((source) => Boolean(source.source_type && source.source_id && source.relationship_type)).map((source) => source.memory_id));
  const divisor = totalMemories || 1;

  return {
    activeCount: memories.filter((memory) => memory.status === "active").length,
    frozenCount: memories.filter((memory) => memory.status === "frozen").length,
    archivedCount: memories.filter((memory) => memory.status === "archived").length,
    deprecatedCount: memories.filter((memory) => memory.status === "deprecated").length,
    sourceCoverage: Math.min(1, Math.max(0, sourceMemoryIds.size / divisor)),
    lineageCoverage: Math.min(1, Math.max(0, validLineageMemoryIds.size / divisor)),
  };
}

export async function getMemoryHealth(workspaceId: string): Promise<MemoryResult<MemoryHealth>> {
  const memories = await listWorkspaceMemory(workspaceId); if (!memories.ok) return memories as MemoryResult<MemoryHealth>;
  const supabase = await createSupabaseServerClient();
  const ids = memories.data.map((m) => m.id);
  const { data: sources } = ids.length ? await supabase.from("organizational_memory_sources").select(sourceColumns).in("memory_id", ids).returns<MemorySource[]>() : { data: [] as MemorySource[] };
  return { ok: true, data: computeMemoryHealthSnapshot(memories.data, sources ?? []) };
}
