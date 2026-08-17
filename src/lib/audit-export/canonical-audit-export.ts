/**
 * P2-20 — canonical audit export composition layer.
 *
 * Composition, not derivation:
 *
 *   canonical operational-flow persisted state
 *        -> getCompleteLineageProjection() / reconstructAuditTrail()   (VERIFIED P2-10)
 *        -> THIS layer: scope identity, allowlist + redaction, honesty markers, ordering
 *        -> AuditExportPackage
 *
 * This module issues NO database query of its own and builds NO aggregate. Every lineage
 * fact — step status, gap, dispute, transition relationship, governance integrity,
 * reconstruction labelling — is carried through from the verified projection verbatim.
 * Nothing here re-classifies a relationship, substitutes a missing entity, or promotes
 * correlation to causation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCompleteLineageProjection,
  reconstructAuditTrail,
} from "@/lib/operational-flow/operational-flow-service";
import type {
  AuditReconstructionItem,
  CompleteLineageProjection,
  LineageStepKind,
  LineageStepNode,
} from "@/lib/operational-flow/types";
import {
  PRESERVED_AUDIT_FIELDS,
  REDACTED_CATEGORIES,
  applyEntityAllowlist,
  redactAuditRecord,
  redactText,
  redactTextArray,
} from "./redaction";
import {
  CANONICAL_AUDIT_EXPORT_FORMAT,
  LEGACY_DECISION_AUDIT_COMPATIBILITY_FORMAT,
  REDACTION_MARKER,
  type AuditExportAssociationBasis,
  type AuditExportAuditRecord,
  type AuditExportCanonicalReferences,
  type AuditExportGovernanceReference,
  type AuditExportLineage,
  type AuditExportLineageEvent,
  type AuditExportOutcomeAssessment,
  type AuditExportPackage,
  type AuditExportStep,
} from "./types";

export const CANONICAL_AUDIT_EXPORT_SOURCE =
  "src/lib/operational-flow/operational-flow-service.ts#getCompleteLineageProjection+reconstructAuditTrail";

const DEFAULT_AUDIT_RECORD_LIMIT = 100;

/**
 * Severity precedence for `lineageStatus`, identical to the ordering
 * getCompleteLineageProjection() itself applies. Restated here only to fold many
 * lineages into one package-level status; the per-lineage value is never recomputed.
 */
const LINEAGE_STATUS_SEVERITY: Record<CompleteLineageProjection["lineageStatus"], number> = {
  complete: 0,
  incomplete: 1,
  degraded: 2,
  inconclusive: 3,
  disputed: 4,
};

export type BuildCanonicalAuditExportOptions = {
  outcomeId?: string;
  taskId?: string;
  correlationId?: string;
  auditRecordLimit?: number;
  /** Test/replay seam. Defaults to now. The ONLY field allowed to vary between exports. */
  generatedAt?: string;
};

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const stringValue = String(value);
  return stringValue.length > 0 ? stringValue : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function boolOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** Same tolerant timestamp parse reconstructAuditTrail uses: unparseable sorts oldest. */
function parseTime(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Deterministic (occurredAt, recordedAt, id) ordering. Row arrival order is never used. */
function byTimeThenId(
  a: { occurredAt: string | null; recordedAt: string | null; id: string | null },
  b: { occurredAt: string | null; recordedAt: string | null; id: string | null },
): number {
  return (
    (a.occurredAt ?? "").localeCompare(b.occurredAt ?? "") ||
    (a.recordedAt ?? "").localeCompare(b.recordedAt ?? "") ||
    (a.id ?? "").localeCompare(b.id ?? "")
  );
}

/**
 * Preserves the canonical step SEQUENCE (kind order as emitted by the verified
 * projection) while making the order of same-kind steps — in practice the observation
 * steps, whose source query ties on recorded_at — independent of row arrival order.
 */
function orderStepsDeterministically(steps: readonly LineageStepNode[]): LineageStepNode[] {
  const kindOrder: LineageStepKind[] = [];
  const grouped = new Map<LineageStepKind, LineageStepNode[]>();
  for (const step of steps) {
    const existing = grouped.get(step.kind);
    if (existing) {
      existing.push(step);
      continue;
    }
    grouped.set(step.kind, [step]);
    kindOrder.push(step.kind);
  }
  return kindOrder.flatMap((kind) => [...(grouped.get(kind) ?? [])].sort(byTimeThenId));
}

function toExportStep(
  step: LineageStepNode,
  redactedKeys: Set<string>,
  redactedSurfaces: Set<string>,
): AuditExportStep {
  const allowlisted = applyEntityAllowlist(step.kind, step.entity, redactedKeys);
  return {
    kind: step.kind,
    id: step.id,
    // title/summary/gapReason interpolate persisted free text from the canonical row whose
    // raw columns the allowlist withholds; they are redacted on the same terms.
    title: redactText(`step.${step.kind}.title`, step.title, redactedSurfaces),
    status: step.status,
    summary: redactText(`step.${step.kind}.summary`, step.summary, redactedSurfaces),
    correlationId: step.correlationId,
    causationId: step.causationId,
    isFixture: step.isFixture,
    fixtureLabel: redactText(`step.${step.kind}.fixtureLabel`, step.fixtureLabel, redactedSurfaces),
    gapReason: redactText(`step.${step.kind}.gapReason`, step.gapReason, redactedSurfaces),
    occurredAt: step.occurredAt,
    recordedAt: step.recordedAt,
    actorId: step.actorId,
    evidenceAssertionType: step.evidenceAssertionType ?? null,
    confidenceScore: step.confidenceScore ?? null,
    missingDataState: step.missingDataState ?? null,
    entityFields: allowlisted?.fields ?? null,
    withheldEntityFields: allowlisted?.withheld ?? [],
  };
}

/**
 * AOC-E governance references, read from the evaluation the VERIFIED projection attached
 * to the material_action step. `authorization_evidence` — the raw AOC-E response blob — is
 * deliberately NOT copied: PMFreak exports references and status, never AOC-owned evidence.
 */
function toGovernanceReferences(
  step: LineageStepNode | undefined,
  redactedSurfaces: Set<string>,
): AuditExportGovernanceReference[] {
  if (!step) return [];
  const entity = step.entity as (Record<string, unknown> & { evaluation?: Record<string, unknown> }) | null;
  const evaluation = entity?.evaluation;
  if (!entity || !evaluation) return [];
  const reference = (field: string, value: unknown) =>
    redactText(`governanceReference.${field}`, text(value), redactedSurfaces);
  return [
    {
      evaluationId: text(evaluation.id),
      actionId: text(evaluation.action_id) ?? text(entity.id),
      contractVersion: reference("contractVersion", evaluation.contract_version),
      evaluatorKind: reference("evaluatorKind", evaluation.evaluator_kind),
      governanceState: reference("governanceState", evaluation.governance_state),
      // Reused from the verified P2-10 fail-safe mapping. Never recomputed here.
      governanceIntegrity: step.status,
      policyDecisionReference: reference("policyDecisionReference", evaluation.policy_decision_reference),
      grantReferences: redactTextArray("governanceReference.grantReferences", stringArray(evaluation.grant_references), redactedSurfaces),
      obligationReferences: redactTextArray("governanceReference.obligationReferences", stringArray(evaluation.obligation_references), redactedSurfaces),
      approvalReferences: redactTextArray("governanceReference.approvalReferences", stringArray(evaluation.approval_references), redactedSurfaces),
      reasonCodes: redactTextArray("governanceReference.reasonCodes", stringArray(evaluation.reason_codes), redactedSurfaces),
      evaluatedAt: text(evaluation.evaluated_at),
      recordedAt: text(evaluation.recorded_at),
      validUntil: text(evaluation.valid_until),
      canCommitAction: boolOrNull(evaluation.can_commit_action),
      canExecute: boolOrNull(evaluation.can_execute),
      pmfreakOwnsGovernanceEvidence: false,
      authorityOwner: "AOC-E",
    },
  ];
}

function stepId(steps: readonly LineageStepNode[], kind: LineageStepKind): string | null {
  return steps.find((step) => step.kind === kind)?.id ?? null;
}

function toCanonicalReferences(
  projection: CompleteLineageProjection,
  steps: readonly LineageStepNode[],
  governanceReferences: readonly AuditExportGovernanceReference[],
): AuditExportCanonicalReferences {
  return {
    sourceId: stepId(steps, "source"),
    rawInputId: stepId(steps, "raw_input"),
    normalizedEventId: stepId(steps, "normalized_event"),
    evidenceId: stepId(steps, "evidence"),
    findingId: stepId(steps, "finding"),
    recommendationId: stepId(steps, "recommendation"),
    decisionId: stepId(steps, "decision"),
    materialActionId: stepId(steps, "material_action"),
    taskId: projection.taskId,
    internalExecutionId: stepId(steps, "internal_execution"),
    outcomeId: projection.outcomeId,
    observationIds: steps
      .filter((step) => step.kind === "observation" && step.id !== null)
      .map((step) => String(step.id))
      .sort(),
    governanceEvaluationIds: governanceReferences
      .map((reference) => reference.evaluationId)
      .filter((id): id is string => id !== null)
      .sort(),
  };
}

/**
 * Task completion is NOT Outcome achievement. `isAchieved` reads the canonical outcome
 * state and nothing else — task status is exported alongside it purely as context.
 */
function toOutcomeAssessment(
  projection: CompleteLineageProjection,
  taskStep: LineageStepNode | undefined,
  redactedSurfaces: Set<string>,
): AuditExportOutcomeAssessment {
  const isAchieved = projection.outcomeState === "achieved";
  const achievementBasis: AuditExportOutcomeAssessment["achievementBasis"] =
    projection.observationsCount === 0
      ? "unobserved_no_canonical_observation"
      : isAchieved
        ? "canonical_outcome_state_achieved"
        : "canonical_outcome_state_not_achieved";
  const taskEntity = taskStep?.entity as Record<string, unknown> | null | undefined;
  return {
    outcomeState: projection.outcomeState,
    latestObservationState: projection.latestObservationState,
    observationsCount: projection.observationsCount,
    isAchieved,
    achievementBasis,
    taskStatus: taskEntity
      ? redactText("outcomeAssessment.taskStatus", text(taskEntity.status), redactedSurfaces)
      : null,
    taskCompletionImpliesOutcomeAchievement: false,
    note: "Outcome achievement is established only by canonical outcome state and evidence-backed observations. A completed Task never implies an achieved Outcome.",
  };
}

/**
 * Classifies how the VERIFIED projection retained a platform event for this lineage.
 * The projection's filter is not changed and not re-run: only the basis it used is named,
 * using the strongest relationship the stored row actually proves.
 */
function classifyLineageEvent(
  row: Record<string, unknown>,
  projection: CompleteLineageProjection,
): { basis: AuditExportAssociationBasis; explanation: string } {
  const rawTable = text(row.raw_reference_table);
  const rawId = text(row.raw_reference_id);
  if (rawTable === "canonical_task_outcomes" && rawId === projection.outcomeId) {
    return {
      basis: "direct_reference",
      explanation: "Stored raw_reference to canonical_task_outcomes matches the exported outcome id.",
    };
  }
  if (rawTable === "execution_tasks" && rawId === projection.taskId) {
    return {
      basis: "direct_reference",
      explanation: "Stored raw_reference to execution_tasks matches the exported task id.",
    };
  }
  const outcomeCorrelationId = projection.steps.find((step) => step.kind === "outcome")?.correlationId;
  if (outcomeCorrelationId && text(row.correlation_id) === outcomeCorrelationId) {
    return {
      basis: "correlation_only",
      explanation:
        "Shared correlation identifier with the canonical outcome. Correlation does NOT imply causation and no causal claim is made.",
    };
  }
  return {
    basis: "unlinked",
    explanation: "No stored reference or correlation to the exported lineage could be established.",
  };
}

function toLineageEvents(
  projection: CompleteLineageProjection,
  redactedKeys: Set<string>,
  redactedSurfaces: Set<string>,
): AuditExportLineageEvent[] {
  return projection.auditEvents
    .map((row) => {
      const { basis, explanation } = classifyLineageEvent(row, projection);
      return {
        id: text(row.id),
        eventType: redactText("lineageEvent.eventType", text(row.event_type), redactedSurfaces),
        eventCategory: redactText("lineageEvent.eventCategory", text(row.event_category), redactedSurfaces),
        occurredAt: text(row.occurred_at),
        recordedAt: text(row.created_at) ?? text(row.occurred_at),
        correlationId: text(row.correlation_id),
        causationId: text(row.causation_id),
        rawReferenceTable: text(row.raw_reference_table),
        rawReferenceId: text(row.raw_reference_id),
        actorId: text(row.actor_id),
        actorType: text(row.actor_type),
        associationBasis: basis,
        associationExplanation: explanation,
        payload: redactAuditRecord((row.event_payload as Record<string, unknown>) ?? {}, redactedKeys),
        metadata: redactAuditRecord((row.metadata as Record<string, unknown>) ?? {}, redactedKeys),
      };
    })
    .sort(byTimeThenId);
}

/**
 * How an audit item entered THIS export. Carried alongside each reconstructed batch so the
 * exported `associationBasis` describes the actual selection path rather than a coarse
 * "was an option set?" boolean — which stops being accurate once a task-scoped request
 * reconstructs per canonical outcome.
 */
type AuditSelection =
  | { kind: "canonical_outcome"; outcomeId: string; viaTaskId: string | null }
  | { kind: "correlation"; correlationId: string }
  | { kind: "project_scope" };

function toAuditRecord(
  item: AuditReconstructionItem,
  selection: AuditSelection,
  redactedKeys: Set<string>,
  redactedSurfaces: Set<string>,
): AuditExportAuditRecord {
  const metadata = redactAuditRecord(item.metadata, redactedKeys);
  const isReconstructed = item.metadata.reconstructed === true;

  let basis: AuditExportAssociationBasis;
  let explanation: string;
  if (isReconstructed) {
    basis = "reconstruction";
    explanation =
      "Reconstructed from a canonical record by the verified P2-10 audit semantics. It is NOT an emitted platform_event.";
  } else if (selection.kind === "canonical_outcome") {
    basis = "correlation_only";
    explanation = selection.viaTaskId
      ? `Selected because it shares the correlation id of canonical outcome ${selection.outcomeId}, which belongs to the requested task ${selection.viaTaskId}. Correlation-only association; completeness is not asserted and no causal claim is made.`
      : `Selected because it shares the correlation id of canonical outcome ${selection.outcomeId}. Correlation-only association; completeness is not asserted and no causal claim is made.`;
  } else if (selection.kind === "correlation") {
    basis = "correlation_only";
    explanation =
      "Selected by the requested correlation id. Correlation-only association; no causal claim is made.";
  } else {
    basis = "unlinked";
    explanation =
      "Selected by workspace and project scope alone; no narrower association was requested or established.";
  }

  return {
    id: item.id,
    eventType: redactText("auditRecord.eventType", item.eventType, redactedSurfaces),
    eventCategory: redactText("auditRecord.eventCategory", item.eventCategory, redactedSurfaces),
    actorId: item.actorId,
    actorType: item.actorType,
    occurredAt: item.occurredAt,
    recordedAt: item.recordedAt,
    correlationId: item.correlationId,
    causationId: item.causationId,
    rawReferenceTable: item.rawReferenceTable,
    rawReferenceId: item.rawReferenceId,
    payload: redactAuditRecord(item.payload, redactedKeys),
    metadata,
    relationship: item.relationship,
    associationBasis: basis,
    associationExplanation: explanation,
    isReconstructed,
    reconstructedFrom: isReconstructed ? String(item.metadata.reconstructedFrom ?? "") || null : null,
  };
}

function toExportLineage(
  projection: CompleteLineageProjection,
  redactedKeys: Set<string>,
  withheldFields: Set<string>,
  redactedSurfaces: Set<string>,
): AuditExportLineage {
  const orderedSteps = orderStepsDeterministically(projection.steps);
  const steps = orderedSteps.map((step) => toExportStep(step, redactedKeys, redactedSurfaces));
  for (const step of steps) for (const field of step.withheldEntityFields) withheldFields.add(field);

  const governanceReferences = toGovernanceReferences(
    orderedSteps.find((step) => step.kind === "material_action"),
    redactedSurfaces,
  ).sort((a, b) => (a.evaluationId ?? "").localeCompare(b.evaluationId ?? ""));

  return {
    outcomeId: projection.outcomeId,
    taskId: projection.taskId,
    // canonical_task_outcomes.expected_result is persisted free text.
    expectedResult: redactText("lineage.expectedResult", projection.expectedResult, redactedSurfaces),
    lineageStatus: projection.lineageStatus,
    hasCorrelationOnly: projection.hasCorrelationOnly,
    isFixture: projection.isFixture,
    fixtureLabel: redactText("lineage.fixtureLabel", projection.fixtureLabel, redactedSurfaces),
    canonicalReferences: toCanonicalReferences(projection, orderedSteps, governanceReferences),
    outcomeAssessment: toOutcomeAssessment(
      projection,
      orderedSteps.find((step) => step.kind === "task"),
      redactedSurfaces,
    ),
    steps,
    // Verbatim. Relationship classification is the verified projection's, never this layer's.
    // Its only free-text field is a fixed framework explanation, so nothing is redacted here.
    transitions: projection.transitions,
    governanceReferences,
    lineageEvents: toLineageEvents(projection, redactedKeys, redactedSurfaces),
    // Gaps and disputes interpolate persisted free text (evidence ids, governance states,
    // observation summaries), so they are redacted before ordering. They are an unordered
    // set of findings; sorting makes the payload independent of the order the projection
    // happened to append them in.
    gaps: redactTextArray("lineage.gaps", projection.gaps, redactedSurfaces).sort(),
    disputes: redactTextArray("lineage.disputes", projection.disputes, redactedSurfaces).sort(),
  };
}

/**
 * Builds the single canonical, redacted, gap-aware audit export package for a
 * workspace+project, optionally narrowed to one canonical outcome/task/correlation.
 *
 * Tenancy: this function performs no query. Both canonical sources are already scoped by
 * workspace_id AND project_id (and derive decision_evidence_links tenancy through
 * operational_decision_records, mirroring its RLS policy), so no foreign-tenant row can
 * enter the package through lineage traversal, evidence link, platform-event correlation,
 * outcome lookup or AOC reference projection. `client` must be the caller's authorized
 * request-scoped client; a service-role client is never user authorization.
 */
export async function buildCanonicalAuditExportPackage(
  client: SupabaseClient,
  workspaceId: string,
  projectId: string,
  options: BuildCanonicalAuditExportOptions = {},
): Promise<AuditExportPackage> {
  // A non-finite or non-positive requested limit falls back to the default rather than
  // reaching the database as NaN.
  const requestedLimit = options.auditRecordLimit;
  const auditRecordLimit =
    typeof requestedLimit === "number" && Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.floor(requestedLimit)
      : DEFAULT_AUDIT_RECORD_LIMIT;
  const redactedKeys = new Set<string>();
  const withheldFields = new Set<string>();
  const redactedSurfaces = new Set<string>();

  // 1. Canonical lineage. outcomeId and taskId are BOTH applied by the verified projection,
  //    so an outcomeId that does not belong to the supplied taskId yields no lineage.
  const projections = await getCompleteLineageProjection(client, workspaceId, projectId, {
    outcomeId: options.outcomeId,
    taskId: options.taskId,
  });

  // 2. Correlation narrowing, in the composition layer, using ONLY correlation values the
  //    verified projection already carries. Association by correlation, never causation: a
  //    matching correlation id makes a lineage in scope, it does not make it caused.
  const correlationId = options.correlationId;
  const selectedProjections = correlationId
    ? projections.filter(
        (projection) =>
          projection.steps.some((step) => step.correlationId === correlationId) ||
          projection.transitions.some((transition) => transition.correlationId === correlationId),
      )
    : projections;

  const lineages = [...selectedProjections]
    .sort((a, b) => a.outcomeId.localeCompare(b.outcomeId))
    .map((projection) => toExportLineage(projection, redactedKeys, withheldFields, redactedSurfaces));

  // 3. Audit trail, scoped to match the lineages actually exported.
  //
  //    A request narrowed to a canonical entity (outcomeId and/or taskId) reconstructs PER
  //    SELECTED CANONICAL OUTCOME using the verified P2-10 outcome-scoped behavior, then
  //    merges. Falling back to the project-wide trail here would attach unrelated records to
  //    a package whose requestedScope claims to be narrower. No selected outcome therefore
  //    means no audit records — never a widening fallback.
  //
  //    Each per-outcome trail is already the oldest-first prefix bounded by the same limit,
  //    so the first `limit` of the merged result is the true oldest-first prefix across all
  //    of them — the same reasoning reconstructAuditTrail applies across its two sources.
  const narrowedToCanonicalEntity = Boolean(options.outcomeId || options.taskId);
  const selectedOutcomeIds = [...new Set(lineages.map((lineage) => lineage.outcomeId))].sort();

  let auditRecords: AuditExportAuditRecord[];
  if (narrowedToCanonicalEntity) {
    const perOutcome = await Promise.all(
      selectedOutcomeIds.map(async (selectedOutcomeId) => {
        const items = await reconstructAuditTrail(client, workspaceId, projectId, {
          outcomeId: selectedOutcomeId,
          correlationId,
          limit: auditRecordLimit,
        });
        const selection: AuditSelection = {
          kind: "canonical_outcome",
          outcomeId: selectedOutcomeId,
          viaTaskId: options.taskId ?? null,
        };
        return items.map((item) => ({ item, selection }));
      }),
    );
    // Deduplicate by stable audit item id. Outcome ids are sorted, so when the same record
    // is reachable through two outcomes the retained attribution is deterministic.
    const seen = new Set<string>();
    auditRecords = perOutcome
      .flat()
      .filter(({ item }) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .sort(
        (a, b) =>
          parseTime(a.item.occurredAt) - parseTime(b.item.occurredAt) ||
          parseTime(a.item.recordedAt) - parseTime(b.item.recordedAt) ||
          a.item.id.localeCompare(b.item.id),
      )
      .slice(0, auditRecordLimit)
      .map(({ item, selection }) => toAuditRecord(item, selection, redactedKeys, redactedSurfaces));
  } else {
    const items = await reconstructAuditTrail(client, workspaceId, projectId, {
      correlationId,
      limit: auditRecordLimit,
    });
    const selection: AuditSelection = correlationId
      ? { kind: "correlation", correlationId }
      : { kind: "project_scope" };
    auditRecords = items.map((item) => toAuditRecord(item, selection, redactedKeys, redactedSurfaces));
  }

  const gapCount = lineages.reduce((total, lineage) => total + lineage.gaps.length, 0);
  const disputeCount = lineages.reduce((total, lineage) => total + lineage.disputes.length, 0);
  const completeLineageCount = lineages.filter((lineage) => lineage.lineageStatus === "complete").length;
  const overallStatus = lineages.length
    ? lineages.reduce<CompleteLineageProjection["lineageStatus"]>(
        (worst, lineage) =>
          LINEAGE_STATUS_SEVERITY[lineage.lineageStatus] > LINEAGE_STATUS_SEVERITY[worst]
            ? lineage.lineageStatus
            : worst,
        "complete",
      )
    : "incomplete";

  const notes: string[] = [];
  if (!lineages.length) {
    notes.push(
      "No canonical lineage matched the requested scope. Nothing was synthesised to fill the request.",
    );
  }
  if (gapCount > 0) notes.push(`${gapCount} explicit lineage gap(s) preserved without substitution.`);
  if (disputeCount > 0) notes.push(`${disputeCount} explicit dispute(s) preserved.`);
  if (correlationId && projections.length !== selectedProjections.length) {
    notes.push(
      `Correlation scope excluded ${projections.length - selectedProjections.length} canonical lineage(s) that do not carry correlation id ${correlationId}. Association is by correlation only and implies no causation.`,
    );
  }
  if (narrowedToCanonicalEntity) {
    notes.push(
      selectedOutcomeIds.length
        ? `Audit records were reconstructed per selected canonical outcome (${selectedOutcomeIds.join(", ")}) and merged; no project-wide records were added.`
        : "No canonical outcome matched the requested scope, so no audit records were included. The project-wide trail was deliberately NOT used as a fallback.",
    );
  }
  if (auditRecords.length === auditRecordLimit) {
    notes.push(
      `Audit records reached the requested limit of ${auditRecordLimit}; the trail is oldest-first and may be truncated.`,
    );
  }

  return {
    exportFormat: CANONICAL_AUDIT_EXPORT_FORMAT,
    exportVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    requestedScope: {
      workspaceId,
      projectId,
      outcomeId: options.outcomeId ?? null,
      taskId: options.taskId ?? null,
      correlationId: options.correlationId ?? null,
      auditRecordLimit,
    },
    lineages,
    auditRecords,
    integrity: {
      overallStatus,
      lineageCount: lineages.length,
      completeLineageCount,
      gapCount,
      disputeCount,
      hasCorrelationOnly: lineages.some((lineage) => lineage.hasCorrelationOnly),
      containsFixture: lineages.some((lineage) => lineage.isFixture),
      isComplete: lineages.length > 0 && overallStatus === "complete" && gapCount === 0 && disputeCount === 0,
      eventAssociationComplete: false,
      notes,
    },
    redaction: {
      policyVersion: "pmfreak.audit-export-redaction.v1",
      strategy: "entity_field_allowlist_plus_bounded_recursive_value_redaction",
      marker: REDACTION_MARKER,
      redactedCategories: [...REDACTED_CATEGORIES],
      withheldEntityFields: [...withheldFields].sort(),
      redactedPayloadKeys: [...redactedKeys].sort(),
      redactedTextSurfaces: [...redactedSurfaces].sort(),
      preservedAuditFields: [...PRESERVED_AUDIT_FIELDS],
    },
    aocBoundary: {
      identityIntegrityCapabilityOwner: "AOC-P",
      policyAuthorityObligationOwner: "AOC-E",
      pmBusinessObjectOwner: "PMFreak",
      allowDecisionWriteback: false,
      exportedArtifacts: "references_and_status_projections_only",
      note: "PMFreak exports the AOC governance references and status projections it already persists. It does not own, copy or manufacture AOC policy state, grants, authority, obligations, delegation or revocation proof.",
    },
    compatibility: {
      canonicalSource: CANONICAL_AUDIT_EXPORT_SOURCE,
      legacyModelsNotMerged: [
        "project_decisions",
        "project_decision_evidence_links",
        "decision_outcomes",
        "operational_decisions",
        "recommended_action_decisions",
      ],
      legacyCompatibilityEntryPoint: LEGACY_DECISION_AUDIT_COMPATIBILITY_FORMAT,
      notes: [
        "This package is the canonical PM operational lineage export. Legacy decision-governance models remain bounded compatibility models and are neither merged into nor represented by this package.",
        "Platform-event association for an outcome-scoped request is correlation-only; no emitter tags platform_events with a canonical outcome id, so event-side completeness is not asserted.",
        "Governance is exported as the AOC-E evaluation reference attached to the canonical material action by the verified P2-10 projection; PMFreak's own governance_events row is not a step in that verified contract and none is invented here.",
      ],
    },
  };
}
