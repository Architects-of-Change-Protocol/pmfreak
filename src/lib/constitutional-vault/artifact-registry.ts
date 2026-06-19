import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ArchiveArtifactInput,
  ConstitutionalArtifactRow,
  ConstitutionalVaultEventType,
  RegisterArtifactInput,
  UpdateArtifactInput,
  VaultResult,
} from "./types";

const artifactColumns =
  "id,workspace_id,artifact_type,title,description,storage_provider,storage_reference,storage_path,checksum,uploaded_by,created_at,deleted_at";

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

async function emitArtifactEvent(
  artifact: ConstitutionalArtifactRow,
  eventType: ConstitutionalVaultEventType,
  actorId: string,
  payload: Record<string, unknown>,
): Promise<VaultResult<ConstitutionalArtifactRow>> {
  const event = await createPlatformEvent({
    workspaceId: artifact.workspace_id,
    actorId,
    actorType: "user",
    eventType,
    eventCategory: "governance",
    source: "user_action",
    correlationId: artifact.id,
    causationId: null,
    rawReferenceTable: "constitutional_artifacts",
    rawReferenceId: artifact.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: payload,
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: artifact };
}

// ─── Register Artifact ────────────────────────────────────────────────────────

export async function registerArtifact(input: RegisterArtifactInput): Promise<VaultResult<ConstitutionalArtifactRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.uploadedBy)) return validation("uploadedBy must be a UUID.");
  if (!required(input.title)) return validation("title is required.");
  if (!required(input.storageReference)) return validation("storageReference is required.");
  if (!required(input.checksum)) return validation("checksum is required.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_artifacts")
    .insert({
      workspace_id: input.workspaceId,
      artifact_type: input.artifactType,
      title: input.title.trim(),
      description: input.description ?? null,
      storage_provider: input.storageProvider,
      storage_reference: input.storageReference,
      storage_path: input.storagePath ?? null,
      checksum: input.checksum,
      uploaded_by: input.uploadedBy,
    })
    .select(artifactColumns)
    .single<ConstitutionalArtifactRow>();

  if (error || !data) return failed("Unable to register constitutional artifact.");

  return emitArtifactEvent(data, "CONSTITUTIONAL_ARTIFACT_REGISTERED", input.uploadedBy, {
    artifactId: data.id,
    artifactType: data.artifact_type,
    title: data.title,
    storageProvider: data.storage_provider,
    checksum: data.checksum,
  });
}

// ─── Get Artifact ─────────────────────────────────────────────────────────────

export async function getArtifact(
  artifactId: string,
  workspaceId: string,
): Promise<VaultResult<ConstitutionalArtifactRow>> {
  if (!validUuid(artifactId)) return validation("artifactId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_artifacts")
    .select(artifactColumns)
    .eq("id", artifactId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single<ConstitutionalArtifactRow>();

  if (error || !data) return failed("Constitutional artifact not found.", "not_found");
  return { ok: true, data };
}

// ─── List Artifacts ───────────────────────────────────────────────────────────

export async function listArtifacts(
  workspaceId: string,
  filters?: { artifactType?: string; includeArchived?: boolean },
): Promise<VaultResult<ConstitutionalArtifactRow[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("constitutional_artifacts")
    .select(artifactColumns)
    .eq("workspace_id", workspaceId);

  if (!filters?.includeArchived) query = query.is("deleted_at", null);
  if (filters?.artifactType) query = query.eq("artifact_type", filters.artifactType);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return failed("Unable to list constitutional artifacts.");
  return { ok: true, data: (data ?? []) as ConstitutionalArtifactRow[] };
}

// ─── Update Artifact ──────────────────────────────────────────────────────────

export async function updateArtifact(input: UpdateArtifactInput): Promise<VaultResult<ConstitutionalArtifactRow>> {
  if (!validUuid(input.artifactId)) return validation("artifactId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const current = await getArtifact(input.artifactId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.deleted_at !== null) {
    return failed("Archived artifacts are read-only and cannot be updated.", "governance_violation");
  }

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) {
    if (!required(input.title)) return validation("title cannot be empty.");
    patch.title = input.title.trim();
  }
  if (input.description !== undefined) patch.description = input.description;
  if (input.storageReference !== undefined) {
    if (!required(input.storageReference)) return validation("storageReference cannot be empty.");
    patch.storage_reference = input.storageReference;
  }
  if (input.storagePath !== undefined) patch.storage_path = input.storagePath;
  if (input.checksum !== undefined) {
    if (!required(input.checksum)) return validation("checksum cannot be empty.");
    patch.checksum = input.checksum;
  }

  if (Object.keys(patch).length === 0) return { ok: true, data: current.data };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_artifacts")
    .update(patch)
    .eq("id", input.artifactId)
    .eq("workspace_id", input.workspaceId)
    .select(artifactColumns)
    .single<ConstitutionalArtifactRow>();

  if (error || !data) return failed("Unable to update constitutional artifact.");

  return emitArtifactEvent(data, "CONSTITUTIONAL_ARTIFACT_UPDATED", input.actorId, {
    artifactId: data.id,
    updatedFields: Object.keys(patch),
  });
}

// ─── Archive Artifact (Soft Delete) ──────────────────────────────────────────

export async function archiveArtifact(input: ArchiveArtifactInput): Promise<VaultResult<ConstitutionalArtifactRow>> {
  if (!validUuid(input.artifactId)) return validation("artifactId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const current = await getArtifact(input.artifactId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.deleted_at !== null) {
    return failed("Artifact is already archived.", "governance_violation");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_artifacts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", input.artifactId)
    .eq("workspace_id", input.workspaceId)
    .select(artifactColumns)
    .single<ConstitutionalArtifactRow>();

  if (error || !data) return failed("Unable to archive constitutional artifact.");

  return emitArtifactEvent(data, "CONSTITUTIONAL_ARTIFACT_ARCHIVED", input.actorId, {
    artifactId: data.id,
    artifactType: data.artifact_type,
    title: data.title,
    archivedAt: data.deleted_at,
  });
}
