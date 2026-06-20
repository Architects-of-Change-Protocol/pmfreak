// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Digest — Digest Registry
// Lifecycle management: create, generate, validate, publish, archive, list.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CONSTITUTIONAL_DIGEST_CLASSIFICATION_SELECTABLE_COLUMNS,
  CONSTITUTIONAL_DIGEST_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import { anonymizeText, containsPii } from "./anonymization-engine";
import { calculateDigestConfidence } from "./confidence-engine";
import { extractPatterns } from "./pattern-extraction-engine";
import type {
  ArchiveDigestInput,
  ConstitutionalDigestClassificationRow,
  ConstitutionalDigestRow,
  ConstitutionalDigestEventType,
  CreateDigestInput,
  DigestClassificationType,
  DigestResult,
  GenerateDigestInput,
  ListDigestsInput,
  PublishDigestInput,
  ValidateDigestInput,
} from "./types";

const digestColumns = CONSTITUTIONAL_DIGEST_SELECTABLE_COLUMNS.join(",");
const classificationColumns = CONSTITUTIONAL_DIGEST_CLASSIFICATION_SELECTABLE_COLUMNS.join(",");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}

function validation<T>(error: string): DigestResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

function failed<T>(
  error: string,
  failureClass: Extract<DigestResult<never>, { ok: false }>["failureClass"] = "persistence_failed",
): DigestResult<T> {
  return { ok: false, error, failureClass };
}

async function emitDigestEvent(
  workspaceId: string,
  actorId: string,
  digestId: string,
  eventType: ConstitutionalDigestEventType,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  return createPlatformEvent({
    workspaceId,
    actorId,
    actorType: "user",
    eventType,
    eventCategory: "governance",
    source: "user_action",
    correlationId: digestId,
    causationId: null,
    rawReferenceTable: "constitutional_digests",
    rawReferenceId: digestId,
    learningEligible: true,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: payload,
  });
}

// ─── Get Digest ───────────────────────────────────────────────────────────────

export async function getDigest(
  digestId: string,
  workspaceId: string,
): Promise<DigestResult<ConstitutionalDigestRow>> {
  if (!validUuid(digestId)) return validation("digestId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_digests")
    .select(digestColumns)
    .eq("id", digestId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single<ConstitutionalDigestRow>();

  if (error || !data) return failed("Constitutional digest not found.", "not_found");
  return { ok: true, data };
}

// ─── Create Digest ────────────────────────────────────────────────────────────

export async function createDigest(
  input: CreateDigestInput,
): Promise<DigestResult<ConstitutionalDigestRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.memoryRecordId)) return validation("memoryRecordId must be a UUID.");
  if (!validUuid(input.createdBy)) return validation("createdBy must be a UUID.");

  // Verify memory record belongs to workspace
  const supabase = await createSupabaseServerClient();
  const { data: memCheck } = await supabase
    .from("constitutional_memory_records")
    .select("id")
    .eq("id", input.memoryRecordId)
    .eq("workspace_id", input.workspaceId)
    .single();
  if (!memCheck) return failed("Memory record not found in this workspace.", "not_found");

  const { data, error } = await supabase
    .from("constitutional_digests")
    .insert({
      workspace_id: input.workspaceId,
      memory_record_id: input.memoryRecordId,
      digest_status: "draft",
      digest_payload: {},
      created_by: input.createdBy,
    })
    .select(digestColumns)
    .single<ConstitutionalDigestRow>();

  if (error || !data) return failed("Unable to create constitutional digest.");

  const emitted = await emitDigestEvent(
    data.workspace_id,
    input.createdBy,
    data.id,
    "CONSTITUTIONAL_DIGEST_CREATED",
    { digestId: data.id, memoryRecordId: data.memory_record_id },
  );
  if (!emitted.ok) return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };

  return { ok: true, data };
}

// ─── Generate Digest ──────────────────────────────────────────────────────────

export async function generateDigest(
  input: GenerateDigestInput,
): Promise<DigestResult<ConstitutionalDigestRow>> {
  if (!validUuid(input.digestId)) return validation("digestId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const digestResult = await getDigest(input.digestId, input.workspaceId);
  if (!digestResult.ok) return digestResult;

  const digest = digestResult.data;
  if (digest.digest_status !== "draft") {
    return failed("Digest must be in draft status to generate.", "governance_violation");
  }

  const supabase = await createSupabaseServerClient();

  // Fetch the memory record to extract text
  const { data: memory } = await supabase
    .from("constitutional_memory_records")
    .select("canonical_text,summary,memory_type,title")
    .eq("id", digest.memory_record_id)
    .eq("workspace_id", input.workspaceId)
    .single();

  if (!memory) return failed("Memory record not found.", "not_found");

  const sourceText = [memory.title, memory.summary ?? "", memory.canonical_text].join(" ");

  // Step 1: Anonymize
  const anonymization = anonymizeText(sourceText);

  // Step 2: Extract patterns
  const patterns = extractPatterns(anonymization.anonymizedText);

  // Build payload
  const payload: Record<string, unknown> = {};
  if (patterns.industry) payload.industry = patterns.industry;
  if (patterns.projectType) payload.project_type = patterns.projectType;
  if (patterns.decisionPatterns.length) payload.decision_patterns = patterns.decisionPatterns;
  if (patterns.riskPatterns.length) payload.risk_patterns = patterns.riskPatterns;
  if (patterns.governancePatterns.length) payload.governance_patterns = patterns.governancePatterns;
  if (patterns.outcomePatterns.length) payload.outcome_patterns = patterns.outcomePatterns;

  const { data: updated, error: updateError } = await supabase
    .from("constitutional_digests")
    .update({ digest_status: "generated", digest_payload: payload })
    .eq("id", input.digestId)
    .eq("workspace_id", input.workspaceId)
    .eq("digest_status", "draft")
    .select(digestColumns)
    .single<ConstitutionalDigestRow>();

  if (updateError || !updated) return failed("Unable to update digest.");

  // Persist classifications
  const classificationRows: Array<{
    workspace_id: string;
    digest_id: string;
    classification_type: DigestClassificationType;
    classification_value: string;
    confidence_score: number;
  }> = [];

  if (patterns.industry) {
    classificationRows.push({ workspace_id: input.workspaceId, digest_id: input.digestId, classification_type: "industry", classification_value: patterns.industry, confidence_score: 0.8 });
  }
  if (patterns.projectType) {
    classificationRows.push({ workspace_id: input.workspaceId, digest_id: input.digestId, classification_type: "project_type", classification_value: patterns.projectType, confidence_score: 0.75 });
  }
  for (const p of patterns.decisionPatterns) {
    classificationRows.push({ workspace_id: input.workspaceId, digest_id: input.digestId, classification_type: "decision", classification_value: p, confidence_score: 0.7 });
  }
  for (const p of patterns.riskPatterns) {
    classificationRows.push({ workspace_id: input.workspaceId, digest_id: input.digestId, classification_type: "risk", classification_value: p, confidence_score: 0.7 });
  }
  for (const p of patterns.governancePatterns) {
    classificationRows.push({ workspace_id: input.workspaceId, digest_id: input.digestId, classification_type: "governance", classification_value: p, confidence_score: 0.65 });
  }
  for (const p of patterns.outcomePatterns) {
    classificationRows.push({ workspace_id: input.workspaceId, digest_id: input.digestId, classification_type: "outcome", classification_value: p, confidence_score: 0.7 });
  }

  if (classificationRows.length > 0) {
    const { error: classError } = await supabase
      .from("constitutional_digest_classifications")
      .insert(classificationRows);
    if (classError) return failed("Unable to persist digest classifications.");
  }

  // Emit events
  const anonymizeEmitted = await emitDigestEvent(
    input.workspaceId, input.actorId, input.digestId,
    "CONSTITUTIONAL_DIGEST_ANONYMIZED",
    { removedEntities: anonymization.removedEntities.length, normalizations: anonymization.normalizations.length },
  );
  if (!anonymizeEmitted.ok) return { ok: false, error: anonymizeEmitted.error!, failureClass: "event_emission_failed" };

  const patternEmitted = await emitDigestEvent(
    input.workspaceId, input.actorId, input.digestId,
    "CONSTITUTIONAL_DIGEST_PATTERN_EXTRACTED",
    {
      decisionPatterns: patterns.decisionPatterns,
      riskPatterns: patterns.riskPatterns,
      governancePatterns: patterns.governancePatterns,
      outcomePatterns: patterns.outcomePatterns,
    },
  );
  if (!patternEmitted.ok) return { ok: false, error: patternEmitted.error!, failureClass: "event_emission_failed" };

  if (classificationRows.length > 0) {
    const classEmitted = await emitDigestEvent(
      input.workspaceId, input.actorId, input.digestId,
      "CONSTITUTIONAL_DIGEST_CLASSIFIED",
      { classificationCount: classificationRows.length },
    );
    if (!classEmitted.ok) return { ok: false, error: classEmitted.error!, failureClass: "event_emission_failed" };
  }

  const genEmitted = await emitDigestEvent(
    input.workspaceId, input.actorId, input.digestId,
    "CONSTITUTIONAL_DIGEST_GENERATED",
    { digestId: input.digestId, payloadKeys: Object.keys(payload) },
  );
  if (!genEmitted.ok) return { ok: false, error: genEmitted.error!, failureClass: "event_emission_failed" };

  return { ok: true, data: updated };
}

// ─── Validate Digest ──────────────────────────────────────────────────────────

export async function validateDigest(
  input: ValidateDigestInput,
): Promise<DigestResult<ConstitutionalDigestRow>> {
  if (!validUuid(input.digestId)) return validation("digestId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const digestResult = await getDigest(input.digestId, input.workspaceId);
  if (!digestResult.ok) return digestResult;

  const digest = digestResult.data;
  if (digest.digest_status !== "generated") {
    return failed("Digest must be in generated status to validate.", "governance_violation");
  }

  // Check payload does not contain PII
  const payloadStr = JSON.stringify(digest.digest_payload);
  if (containsPii(payloadStr)) {
    return failed(
      "Digest payload contains identifiable information and cannot be validated.",
      "governance_violation",
    );
  }

  // Calculate confidence
  const supabase = await createSupabaseServerClient();
  const { data: classifications } = await supabase
    .from("constitutional_digest_classifications")
    .select("id")
    .eq("digest_id", input.digestId)
    .eq("workspace_id", input.workspaceId);

  const confidence = calculateDigestConfidence({
    payload: digest.digest_payload,
    classificationCount: (classifications ?? []).length,
    hasArtifactLink: true,
  });

  const { data: updated, error } = await supabase
    .from("constitutional_digests")
    .update({ digest_status: "validated", confidence_score: confidence.overall })
    .eq("id", input.digestId)
    .eq("workspace_id", input.workspaceId)
    .select(digestColumns)
    .single<ConstitutionalDigestRow>();

  if (error || !updated) return failed("Unable to validate digest.");

  const confEmitted = await emitDigestEvent(
    input.workspaceId, input.actorId, input.digestId,
    "CONSTITUTIONAL_DIGEST_CONFIDENCE_CALCULATED",
    { ...confidence },
  );
  if (!confEmitted.ok) return { ok: false, error: confEmitted.error!, failureClass: "event_emission_failed" };

  const emitted = await emitDigestEvent(
    input.workspaceId, input.actorId, input.digestId,
    "CONSTITUTIONAL_DIGEST_VALIDATED",
    { digestId: input.digestId, confidenceScore: confidence.overall },
  );
  if (!emitted.ok) return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };

  return { ok: true, data: updated };
}

// ─── Publish Digest ───────────────────────────────────────────────────────────

export async function publishDigest(
  input: PublishDigestInput,
): Promise<DigestResult<ConstitutionalDigestRow>> {
  if (!validUuid(input.digestId)) return validation("digestId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const digestResult = await getDigest(input.digestId, input.workspaceId);
  if (!digestResult.ok) return digestResult;

  if (digestResult.data.digest_status !== "validated") {
    return failed("Digest must pass validation before publishing.", "governance_violation");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_digests")
    .update({ digest_status: "published" })
    .eq("id", input.digestId)
    .eq("workspace_id", input.workspaceId)
    .select(digestColumns)
    .single<ConstitutionalDigestRow>();

  if (error || !data) return failed("Unable to publish digest.");

  const emitted = await emitDigestEvent(
    input.workspaceId, input.actorId, input.digestId,
    "CONSTITUTIONAL_DIGEST_PUBLISHED",
    { digestId: input.digestId },
  );
  if (!emitted.ok) return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };

  return { ok: true, data };
}

// ─── Archive Digest ───────────────────────────────────────────────────────────

export async function archiveDigest(
  input: ArchiveDigestInput,
): Promise<DigestResult<ConstitutionalDigestRow>> {
  if (!validUuid(input.digestId)) return validation("digestId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const digestResult = await getDigest(input.digestId, input.workspaceId);
  if (!digestResult.ok) return digestResult;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_digests")
    .update({ digest_status: "archived", deleted_at: new Date().toISOString() })
    .eq("id", input.digestId)
    .eq("workspace_id", input.workspaceId)
    .select(digestColumns)
    .single<ConstitutionalDigestRow>();

  if (error || !data) return failed("Unable to archive digest.");

  const emitted = await emitDigestEvent(
    input.workspaceId, input.actorId, input.digestId,
    "CONSTITUTIONAL_DIGEST_ARCHIVED",
    { digestId: input.digestId },
  );
  if (!emitted.ok) return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };

  return { ok: true, data };
}

// ─── List Digests ─────────────────────────────────────────────────────────────

export async function listDigests(
  input: ListDigestsInput,
): Promise<DigestResult<ConstitutionalDigestRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("constitutional_digests")
    .select(digestColumns)
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (input.status) query = query.eq("digest_status", input.status);

  const { data, error } = await query;
  if (error) return failed("Unable to list constitutional digests.");

  let results = (data ?? []) as unknown as ConstitutionalDigestRow[];

  // Apply payload-based filters in-memory (JSON field filtering)
  if (input.industry) {
    results = results.filter((d) => d.digest_payload.industry === input.industry);
  }
  if (input.projectType) {
    results = results.filter((d) => d.digest_payload.project_type === input.projectType);
  }
  if (input.riskCategory) {
    results = results.filter((d) =>
      (d.digest_payload.risk_patterns ?? []).includes(input.riskCategory!),
    );
  }
  if (input.decisionType) {
    results = results.filter((d) =>
      (d.digest_payload.decision_patterns ?? []).includes(input.decisionType!),
    );
  }

  return { ok: true, data: results };
}

// ─── List Classifications for Digest ─────────────────────────────────────────

export async function listClassificationsForDigest(
  digestId: string,
  workspaceId: string,
): Promise<DigestResult<ConstitutionalDigestClassificationRow[]>> {
  if (!validUuid(digestId)) return validation("digestId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");

  const digestResult = await getDigest(digestId, workspaceId);
  if (!digestResult.ok) return digestResult as DigestResult<ConstitutionalDigestClassificationRow[]>;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_digest_classifications")
    .select(classificationColumns)
    .eq("digest_id", digestId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) return failed("Unable to list digest classifications.");
  return { ok: true, data: (data ?? []) as unknown as ConstitutionalDigestClassificationRow[] };
}
