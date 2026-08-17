/**
 * P2-20 audit-export redaction.
 *
 * Two mechanisms, applied in this order:
 *
 *  1. ENTITY FIELD ALLOWLIST (`ENTITY_FIELD_ALLOWLIST`). A canonical lineage step carries
 *     a whole database row in `LineageStepNode.entity`. Several of those rows hold
 *     free-form payload/metadata columns (`operational_raw_inputs.payload`,
 *     `operational_normalized_events.event_payload`, `evidence_items.content`/`metadata`,
 *     `material_action_proposals.proposal`, `material_action_governance_evaluations
 *     .authorization_evidence`, `operational_decision_records.authority_evaluation`, the
 *     `provenance` columns) whose contents are unbounded and may carry provider secrets or
 *     raw provider error objects. The export emits an explicit allowlist per step kind and
 *     names every column it withheld, so redaction is visible rather than silent.
 *
 *  2. BOUNDED RECURSIVE VALUE REDACTION. Everything that survives the allowlist — plus the
 *     audit-record payload/metadata, which ARE the audit evidence and cannot be dropped —
 *     is walked by `redactSecretLikeValues()` from src/lib/security/redaction.ts (the
 *     repository's existing Perilla 10 mechanism, depth-bounded at 8) after an
 *     export-specific key sweep for categories that module does not cover by name
 *     (credential/bearer/session/connection-string/raw provider error objects).
 *
 * Redaction never deletes audit metadata. Provenance, actor, timestamps, canonical IDs,
 * evidence references, governance references, relationship classification and material
 * state changes are all preserved — see PRESERVED_AUDIT_FIELDS.
 */

import { redactSecretLikeValues } from "@/lib/security/redaction";
import type { LineageStepKind } from "@/lib/operational-flow/types";
import { REDACTION_MARKER } from "./types";

/**
 * Key fragments redacted by NAME anywhere in the export.
 *
 * The first block mirrors REDACTED_KEY_FRAGMENTS in src/lib/security/redaction.ts. It is
 * restated rather than imported because that constant is module-private, and because the
 * export must be able to NAME every key it redacted in its redaction report — running the
 * shared walker alone would redact silently. The shared walker still runs afterwards for
 * secret-SHAPED values, so the two mechanisms compose rather than replace each other.
 */
const EXPORT_REDACTED_KEY_FRAGMENTS = [
  "secret",
  "token",
  "password",
  "authorization",
  "cookie",
  "service_role",
  "servicerole",
  "webhook",
  "hmac",
  "apikey",
  "api_key",
  "privatekey",
  "private_key",
  "credential",
  "bearer",
  "session",
  "passphrase",
  "connectionstring",
  "connection_string",
  "dsn",
  "rawerror",
  "raw_error",
  "providererror",
  "provider_error",
  "stack",
  "authheader",
  "auth_header",
  "accesskey",
  "access_key",
  "clientsecret",
  "signingkey",
  "signing_key",
  "encryptionkey",
  "encryption_key",
] as const;

/** Categories reported to the auditor as never emitted. */
export const REDACTED_CATEGORIES = [
  "access tokens",
  "refresh tokens",
  "API keys",
  "authorization headers",
  "cookies and session secrets",
  "service-role credentials",
  "provider secrets",
  "raw provider error objects",
  "connection strings",
  "unrestricted credential payloads",
  "raw source payload and free-text content columns",
] as const;

/** Audit-critical fields the export guarantees to preserve through redaction. */
export const PRESERVED_AUDIT_FIELDS = [
  "canonical entity ids",
  "correlationId",
  "causationId",
  "occurredAt",
  "recordedAt",
  "actorId",
  "actorType",
  "lineage step status and gapReason",
  "transition relationship classification",
  "evidence assertion type, confidence and missing-data state",
  "content and event digests",
  "AOC governance references and governance state",
  "material state changes (outcome state, observation state, task/execution status)",
] as const;

export function isExportRedactedKey(key: string): boolean {
  const lower = key.toLowerCase();
  return EXPORT_REDACTED_KEY_FRAGMENTS.some((fragment) => lower.includes(fragment));
}

/**
 * Pass 1 — bounded recursive key sweep. Replaces the value of every sensitive-by-NAME key
 * and records that key so the redaction report can name it. Depth bound matches the shared
 * walker (8).
 */
function sweepSensitiveKeys(input: unknown, redactedKeys: Set<string>, depth: number): unknown {
  if (depth > 8) return "[max-depth]";
  if (Array.isArray(input)) return input.map((item) => sweepSensitiveKeys(item, redactedKeys, depth + 1));
  if (input === null || typeof input !== "object") return input;

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (isExportRedactedKey(key)) {
      redactedKeys.add(key);
      output[key] = REDACTION_MARKER;
      continue;
    }
    output[key] = sweepSensitiveKeys(value, redactedKeys, depth + 1);
  }
  return output;
}

/**
 * Redacts a JSON-like value that must keep its structure (audit payloads/metadata).
 *
 * Pass 1 removes sensitive-by-name keys and records them; pass 2 runs the repository's
 * existing `redactSecretLikeValues()` so secret-SHAPED values (JWTs, `sk_live_…`,
 * `Bearer …`, `service_role…`) are removed even when the key name is innocuous.
 */
export function redactAuditValue(
  input: unknown,
  redactedKeys: Set<string>,
  depth = 0,
): unknown {
  return redactSecretLikeValues(sweepSensitiveKeys(input, redactedKeys, depth), depth);
}

export function redactAuditRecord(
  payload: Record<string, unknown>,
  redactedKeys: Set<string>,
): Record<string, unknown> {
  const result = redactAuditValue(payload, redactedKeys);
  return result && typeof result === "object" && !Array.isArray(result)
    ? (result as Record<string, unknown>)
    : {};
}

/**
 * Columns exported per lineage step kind. Derived from the migrations that own each table:
 *   source              -> operational_sources          (20260901000000)
 *   raw_input           -> operational_raw_inputs       (20260901000000)
 *   normalized_event    -> operational_normalized_events(20260901000000)
 *   evidence            -> evidence_items               (20260611000000 + 20260902000000)
 *   finding             -> operational_signals          (20260611000000)
 *   recommendation      -> recommended_actions          (20260605040000 + 20260611000000)
 *   decision            -> operational_decision_records (20260611000000)
 *   material_action     -> material_action_proposals    (20260903000000)
 *   task                -> execution_tasks              (20260904000000 lineage columns)
 *   internal_execution  -> internal_task_executions     (20260905000000)
 *   outcome             -> canonical_task_outcomes      (20260906000000)
 *   observation         -> canonical_outcome_observations (20260906000000)
 *
 * Free-text/payload columns are deliberately ABSENT from every list. Where a digest exists
 * it is exported instead, so provenance survives without the payload.
 */
export const ENTITY_FIELD_ALLOWLIST: Record<LineageStepKind, readonly string[]> = {
  source: [
    "id", "workspace_id", "project_id", "source_key", "source_kind", "display_name",
    "status", "is_fixture", "fixture_label", "fixture_expires_when", "created_by",
    "created_at", "updated_at",
  ],
  raw_input: [
    "id", "workspace_id", "project_id", "source_id", "external_id", "media_type",
    "content_digest", "status", "occurred_at", "captured_at", "actor_user_id",
    "correlation_id", "causation_id",
  ],
  normalized_event: [
    "id", "workspace_id", "project_id", "source_id", "raw_input_id", "event_type",
    "schema_version", "normalizer_key", "subject_type", "subject_id", "event_digest",
    "status", "occurred_at", "recorded_at", "actor_user_id", "correlation_id",
    "causation_id",
  ],
  evidence: [
    "id", "workspace_id", "project_id", "created_by", "source_type", "source_reference",
    "confidence_level", "status", "evidence_hash", "version",
    "supersedes_evidence_item_id", "frozen_at", "created_at", "updated_at",
    "normalized_event_id", "raw_input_id", "source_id", "derivation_idempotency_key",
    "digest_algorithm", "canonicalization_version", "assertion_type", "classification",
    "confidence_score", "missing_data_state", "freshness_state", "stale_at", "lifecycle",
    "occurred_at", "evaluated_at", "recorded_at", "correlation_id", "causation_id",
    "fixture_state", "degraded_reason",
  ],
  finding: [
    "id", "workspace_id", "project_id", "evidence_item_id", "signal_type", "severity",
    "confidence_score", "detected_by", "status", "created_at",
  ],
  governance: [
    "id", "workspace_id", "project_id", "related_entity_type", "related_entity_id",
    "protocol_reference", "rule_key", "authority_required", "evidence_required",
    "governance_status", "created_at",
  ],
  recommendation: [
    "id", "workspace_id", "project_id", "governance_event_id", "risk_issue_id",
    "signal_id", "raid_item_id", "status", "urgency", "suggested_owner_user_id",
    "created_at", "updated_at",
  ],
  decision: [
    "id", "workspace_id", "project_id", "recommendation_id", "governance_event_id",
    "decided_by", "decision_status", "authority_basis",
    "supersedes_decision_record_id", "created_at",
  ],
  material_action: [
    "id", "workspace_id", "project_id", "source_decision_id", "proposed_by",
    "schema_version", "digest_version", "proposal_digest", "idempotency_key",
    "action_class", "materiality", "correlation_id", "causation_id", "expires_at",
    "created_at", "persisted_at",
  ],
  task: [
    "id", "workspace_id", "project_id", "source_action_id", "status", "priority",
    "assignee_id", "created_by", "correlation_id", "causation_id", "created_at",
    "updated_at", "completed_at", "due_date",
  ],
  internal_execution: [
    "id", "workspace_id", "project_id", "task_id", "governance_evaluation_id", "status",
    "provider_key", "attempt_count", "idempotency_key", "correlation_id", "causation_id",
    "queued_at", "started_at", "completed_at", "created_at", "updated_at",
    "failure_reason_code",
  ],
  outcome: [
    "id", "workspace_id", "project_id", "task_id", "source_action_id", "state",
    "correlation_id", "causation_id", "fixture_label", "created_by", "created_at",
    "updated_at",
  ],
  observation: [
    "id", "workspace_id", "project_id", "outcome_id", "task_id", "observation_state",
    "evidence_reference_ids", "confidence_score", "missing_data_state", "observed_at",
    "recorded_at", "evaluated_at", "stale_at", "observed_by", "correlation_id",
    "causation_id", "idempotency_key", "fixture_label",
  ],
};

export type AllowlistResult = {
  fields: Record<string, unknown>;
  withheld: string[];
};

/**
 * Projects a canonical row down to its allowlisted columns, then runs bounded recursive
 * value redaction over what remains. Column names present on the row but absent from the
 * allowlist are returned so the export can name them.
 *
 * `extraWithheld` lets a caller declare a key it stripped before calling (the export
 * strips the projection-attached `evaluation` / `loadedEvidence` composites, which are not
 * database columns).
 */
export function applyEntityAllowlist(
  kind: LineageStepKind,
  entity: Record<string, unknown> | null,
  redactedKeys: Set<string>,
  extraWithheld: readonly string[] = [],
): AllowlistResult | null {
  if (!entity) return null;
  const allowed = ENTITY_FIELD_ALLOWLIST[kind] ?? [];
  const fields: Record<string, unknown> = {};
  const withheld = new Set<string>(extraWithheld);

  for (const key of Object.keys(entity).sort()) {
    if (!allowed.includes(key)) {
      withheld.add(key);
      continue;
    }
    if (isExportRedactedKey(key)) {
      redactedKeys.add(key);
      fields[key] = REDACTION_MARKER;
      continue;
    }
    fields[key] = redactAuditValue(entity[key], redactedKeys);
  }

  return { fields, withheld: [...withheld].sort() };
}
