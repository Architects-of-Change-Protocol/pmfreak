import { createPlatformEvent } from "@/lib/platform-events";
import { getArtifact } from "./artifact-registry";
import { getMemoryRecord, listLinksForMemoryRecord, listMemoryRecordsByArtifact } from "./memory-registry";
import type {
  ConstitutionalArtifactRow,
  ConstitutionalMemoryLinkRow,
  ConstitutionalMemoryRecordRow,
  MemoryLineage,
  VaultResult,
} from "./types";

function validUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
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

// ─── Get Memory Lineage ───────────────────────────────────────────────────────
// Reconstructs the lineage chain:
//   Artifact → Memory Record → Links (constitution / decision / amendment / ...)

export async function getMemoryLineage(input: {
  memoryRecordId: string;
  workspaceId: string;
  actorId: string;
}): Promise<VaultResult<MemoryLineage>> {
  if (!validUuid(input.memoryRecordId)) return validation("memoryRecordId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const memoryResult = await getMemoryRecord(input.memoryRecordId, input.workspaceId);
  if (!memoryResult.ok) return memoryResult;

  const artifactResult = await getArtifact(memoryResult.data.artifact_id, input.workspaceId);
  if (!artifactResult.ok) return artifactResult;

  const linksResult = await listLinksForMemoryRecord(input.memoryRecordId, input.workspaceId);
  if (!linksResult.ok) return linksResult;

  const lineage: MemoryLineage = {
    artifact: artifactResult.data,
    memoryRecord: memoryResult.data,
    links: linksResult.data,
  };

  const emitted = await createPlatformEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    actorType: "user",
    eventType: "CONSTITUTIONAL_LINEAGE_GENERATED",
    eventCategory: "governance",
    source: "user_action",
    correlationId: input.memoryRecordId,
    causationId: null,
    rawReferenceTable: "constitutional_memory_records",
    rawReferenceId: input.memoryRecordId,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      memoryRecordId: input.memoryRecordId,
      artifactId: artifactResult.data.id,
      artifactType: artifactResult.data.artifact_type,
      linkCount: linksResult.data.length,
      entityTypes: [...new Set(linksResult.data.map((l) => l.entity_type))],
    },
  });
  if (!emitted.ok) return { ok: false, error: emitted.error, failureClass: "event_emission_failed" };

  return { ok: true, data: lineage };
}

// ─── Get Full Artifact Lineage ────────────────────────────────────────────────
// Returns all memory records for an artifact and their entity links.

export type ArtifactLineage = {
  artifact: ConstitutionalArtifactRow;
  memoryRecords: Array<{
    memoryRecord: ConstitutionalMemoryRecordRow;
    links: ConstitutionalMemoryLinkRow[];
  }>;
};

export async function getArtifactLineage(input: {
  artifactId: string;
  workspaceId: string;
}): Promise<VaultResult<ArtifactLineage>> {
  if (!validUuid(input.artifactId)) return validation("artifactId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");

  const artifactResult = await getArtifact(input.artifactId, input.workspaceId);
  if (!artifactResult.ok) return artifactResult;

  const recordsResult = await listMemoryRecordsByArtifact(input.artifactId, input.workspaceId);
  if (!recordsResult.ok) return recordsResult;

  const memoryRecords: ArtifactLineage["memoryRecords"] = [];
  for (const record of recordsResult.data) {
    const linksResult = await listLinksForMemoryRecord(record.id, input.workspaceId);
    if (!linksResult.ok) return failed(`Unable to retrieve links for memory record ${record.id}.`);
    memoryRecords.push({ memoryRecord: record, links: linksResult.data });
  }

  return {
    ok: true,
    data: {
      artifact: artifactResult.data,
      memoryRecords,
    },
  };
}
