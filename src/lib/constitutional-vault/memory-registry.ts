import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getArtifact } from "./artifact-registry";
import type {
  ConstitutionalMemoryLinkRow,
  ConstitutionalMemoryRecordRow,
  ConstitutionalVaultEventType,
  CreateMemoryRecordInput,
  LinkMemoryToEntityInput,
  UpdateMemoryRecordInput,
  VaultResult,
} from "./types";

const memoryColumns =
  "id,workspace_id,artifact_id,memory_type,title,canonical_text,summary,created_at,created_by";

const linkColumns = "id,workspace_id,memory_record_id,entity_type,entity_id,created_at";

function validUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}
function required(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function validation<T>(error: string): VaultResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}
function failed<T>(
  error: string,
  failureClass: Extract<VaultResult<never>, { ok: false }>["failureClass"] = "persistence_failed",
): VaultResult<T> {
  return { ok: false, error, failureClass };
}

async function emitVaultEvent(
  workspaceId: string,
  actorId: string,
  referenceId: string,
  referenceTable: string,
  eventType: ConstitutionalVaultEventType,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  return createPlatformEvent({
    workspaceId,
    actorId,
    actorType: "user",
    eventType,
    eventCategory: "governance",
    source: "user_action",
    correlationId: referenceId,
    causationId: null,
    rawReferenceTable: referenceTable,
    rawReferenceId: referenceId,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: payload,
  });
}

// ─── Get Memory Record ────────────────────────────────────────────────────────

export async function getMemoryRecord(
  memoryRecordId: string,
  workspaceId: string,
): Promise<VaultResult<ConstitutionalMemoryRecordRow>> {
  if (!validUuid(memoryRecordId)) return validation("memoryRecordId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_memory_records")
    .select(memoryColumns)
    .eq("id", memoryRecordId)
    .eq("workspace_id", workspaceId)
    .single<ConstitutionalMemoryRecordRow>();

  if (error || !data) return failed("Constitutional memory record not found.", "not_found");
  return { ok: true, data };
}

// ─── Create Memory Record ─────────────────────────────────────────────────────

export async function createMemoryRecord(
  input: CreateMemoryRecordInput,
): Promise<VaultResult<ConstitutionalMemoryRecordRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.artifactId)) return validation("artifactId must be a UUID.");
  if (!validUuid(input.createdBy)) return validation("createdBy must be a UUID.");
  if (!required(input.title)) return validation("title is required.");
  if (!required(input.canonicalText)) return validation("canonicalText is required.");

  // Verify artifact exists in the same workspace (sovereignty check)
  const artifact = await getArtifact(input.artifactId, input.workspaceId);
  if (!artifact.ok) return artifact;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_memory_records")
    .insert({
      workspace_id: input.workspaceId,
      artifact_id: input.artifactId,
      memory_type: input.memoryType,
      title: input.title.trim(),
      canonical_text: input.canonicalText,
      summary: input.summary ?? null,
      created_by: input.createdBy,
    })
    .select(memoryColumns)
    .single<ConstitutionalMemoryRecordRow>();

  if (error || !data) return failed("Unable to create constitutional memory record.");

  const emitted = await emitVaultEvent(
    data.workspace_id,
    input.createdBy,
    data.id,
    "constitutional_memory_records",
    "CONSTITUTIONAL_MEMORY_CREATED",
    {
      memoryRecordId: data.id,
      artifactId: data.artifact_id,
      memoryType: data.memory_type,
      title: data.title,
    },
  );
  if (!emitted.ok) return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };

  return { ok: true, data };
}

// ─── Update Memory Record ─────────────────────────────────────────────────────

export async function updateMemoryRecord(
  input: UpdateMemoryRecordInput,
): Promise<VaultResult<ConstitutionalMemoryRecordRow>> {
  if (!validUuid(input.memoryRecordId)) return validation("memoryRecordId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const current = await getMemoryRecord(input.memoryRecordId, input.workspaceId);
  if (!current.ok) return current;

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) {
    if (!required(input.title)) return validation("title cannot be empty.");
    patch.title = input.title.trim();
  }
  if (input.canonicalText !== undefined) {
    if (!required(input.canonicalText)) return validation("canonicalText cannot be empty.");
    patch.canonical_text = input.canonicalText;
  }
  if (input.summary !== undefined) patch.summary = input.summary;

  if (Object.keys(patch).length === 0) return { ok: true, data: current.data };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_memory_records")
    .update(patch)
    .eq("id", input.memoryRecordId)
    .eq("workspace_id", input.workspaceId)
    .select(memoryColumns)
    .single<ConstitutionalMemoryRecordRow>();

  if (error || !data) return failed("Unable to update constitutional memory record.");

  const emitted = await emitVaultEvent(
    data.workspace_id,
    input.actorId,
    data.id,
    "constitutional_memory_records",
    "CONSTITUTIONAL_MEMORY_UPDATED",
    {
      memoryRecordId: data.id,
      updatedFields: Object.keys(patch),
    },
  );
  if (!emitted.ok) return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };

  return { ok: true, data };
}

// ─── Link Memory to Entity ────────────────────────────────────────────────────

export async function linkMemoryToEntity(
  input: LinkMemoryToEntityInput,
): Promise<VaultResult<ConstitutionalMemoryLinkRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.memoryRecordId)) return validation("memoryRecordId must be a UUID.");
  if (!validUuid(input.entityId)) return validation("entityId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  // Verify memory record exists in workspace before linking
  const memoryCheck = await getMemoryRecord(input.memoryRecordId, input.workspaceId);
  if (!memoryCheck.ok) return memoryCheck;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_memory_links")
    .insert({
      workspace_id: input.workspaceId,
      memory_record_id: input.memoryRecordId,
      entity_type: input.entityType,
      entity_id: input.entityId,
    })
    .select(linkColumns)
    .single<ConstitutionalMemoryLinkRow>();

  if (error || !data) return failed("Unable to create constitutional memory link.");

  const emitted = await emitVaultEvent(
    data.workspace_id,
    input.actorId,
    data.id,
    "constitutional_memory_links",
    "CONSTITUTIONAL_MEMORY_LINKED",
    {
      linkId: data.id,
      memoryRecordId: data.memory_record_id,
      entityType: data.entity_type,
      entityId: data.entity_id,
    },
  );
  if (!emitted.ok) return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };

  return { ok: true, data };
}

// ─── List Memory Records for Artifact ────────────────────────────────────────

export async function listMemoryRecordsByArtifact(
  artifactId: string,
  workspaceId: string,
): Promise<VaultResult<ConstitutionalMemoryRecordRow[]>> {
  if (!validUuid(artifactId)) return validation("artifactId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_memory_records")
    .select(memoryColumns)
    .eq("artifact_id", artifactId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) return failed("Unable to list constitutional memory records.");
  return { ok: true, data: (data ?? []) as ConstitutionalMemoryRecordRow[] };
}

// ─── List Links for Memory Record ─────────────────────────────────────────────

export async function listLinksForMemoryRecord(
  memoryRecordId: string,
  workspaceId: string,
): Promise<VaultResult<ConstitutionalMemoryLinkRow[]>> {
  if (!validUuid(memoryRecordId)) return validation("memoryRecordId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_memory_links")
    .select(linkColumns)
    .eq("memory_record_id", memoryRecordId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) return failed("Unable to list constitutional memory links.");
  return { ok: true, data: (data ?? []) as ConstitutionalMemoryLinkRow[] };
}
