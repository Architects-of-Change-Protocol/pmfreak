// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Digest — Lineage Engine
// Reconstructs the full chain: Artifact → Memory → Digest
// ─────────────────────────────────────────────────────────────────────────────

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDigest } from "./digest-registry";
import type { DigestLineage, DigestResult } from "./types";

function validUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}
function validation<T>(error: string): DigestResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}
function failed<T>(error: string): DigestResult<T> {
  return { ok: false, error, failureClass: "not_found" };
}

export async function getDigestLineage(input: {
  digestId: string;
  workspaceId: string;
}): Promise<DigestResult<DigestLineage>> {
  if (!validUuid(input.digestId)) return validation("digestId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");

  const digestResult = await getDigest(input.digestId, input.workspaceId);
  if (!digestResult.ok) return digestResult;
  const digest = digestResult.data;

  const supabase = await createSupabaseServerClient();

  const { data: memory } = await supabase
    .from("constitutional_memory_records")
    .select("id,workspace_id,artifact_id,memory_type,title,canonical_text,summary,created_at,created_by")
    .eq("id", digest.memory_record_id)
    .eq("workspace_id", input.workspaceId)
    .single();

  if (!memory) return failed("Memory record for digest not found.");

  const { data: artifact } = await supabase
    .from("constitutional_artifacts")
    .select("id,workspace_id,artifact_type,title,storage_provider,storage_reference,checksum,created_at,deleted_at")
    .eq("id", memory.artifact_id)
    .eq("workspace_id", input.workspaceId)
    .single();

  if (!artifact) return failed("Artifact for digest lineage not found.");

  return {
    ok: true,
    data: {
      artifact,
      memoryRecord: memory,
      digest,
    },
  };
}
