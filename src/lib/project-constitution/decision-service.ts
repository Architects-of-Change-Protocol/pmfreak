import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DECISION_TERMINAL_STATES,
  decisionTransitionValidationFailure,
  validateDecisionTransition,
} from "./decision-state-machine";
import type {
  AddDecisionOptionInput,
  ApproveDecisionInput,
  AttachDecisionEvidenceInput,
  CancelDecisionInput,
  ConstitutionalDecisionStatus,
  CreateDecisionInput,
  DecisionEvidenceRecord,
  DecisionEventName,
  DecisionLinkRecord,
  DecisionOptionRecord,
  DecisionRecord,
  DecisionResult,
  ExecuteDecisionInput,
  LinkDecisionEntityInput,
  ListDecisionsInput,
  ProposeDecisionInput,
  RejectDecisionInput,
  SelectDecisionOptionInput,
  UpdateDecisionInput,
} from "./decision-types";
import { getConstitution } from "./constitution-service";

// ─── Column projections ───────────────────────────────────────────────────────

const decisionColumns =
  "id,workspace_id,constitution_id,title,description,decision_type,context,problem_statement,recommended_option,selected_option,decision_authority,status,created_by,created_at,updated_at,approved_by,approved_at,executed_by,executed_at,cancelled_by,cancelled_at,deleted_at";

const optionColumns =
  "id,workspace_id,decision_id,name,description,advantages,disadvantages,estimated_cost,estimated_effort,selected,created_at";

const evidenceColumns =
  "id,workspace_id,decision_id,evidence_type,reference_id,description,created_by,created_at";

const linkColumns =
  "id,workspace_id,decision_id,link_type,linked_entity_id,created_at";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(value: string | null | undefined): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value)
  );
}

function required(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validation<T>(error: string): DecisionResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

function failed<T>(
  error: string,
  failureClass: Extract<
    DecisionResult<never>,
    { ok: false }
  >["failureClass"] = "persistence_failed",
): DecisionResult<T> {
  return { ok: false, error, failureClass };
}

// ─── Internal: emit decision event ───────────────────────────────────────────

async function emitDecisionEvent(
  decision: DecisionRecord,
  eventType: DecisionEventName,
  actorId: string,
  payload: Record<string, unknown>,
): Promise<DecisionResult<DecisionRecord>> {
  const event = await createPlatformEvent({
    workspaceId: decision.workspace_id,
    actorId,
    actorType: "user",
    eventType,
    eventCategory: "governance",
    source: "user_action",
    correlationId: decision.id,
    causationId: null,
    rawReferenceTable: "constitutional_decisions",
    rawReferenceId: decision.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: payload,
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: decision };
}

// ─── Internal: get decision (workspace-scoped) ────────────────────────────────

async function getDecisionInternal(
  decisionId: string,
  workspaceId: string,
): Promise<DecisionResult<DecisionRecord>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_decisions")
    .select(decisionColumns)
    .eq("id", decisionId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single<DecisionRecord>();

  if (error || !data) return failed("Constitutional decision not found.", "not_found");
  return { ok: true, data };
}

// ─── Internal: transition helper ─────────────────────────────────────────────

async function transitionDecision(
  decisionId: string,
  workspaceId: string,
  actorId: string,
  targetStatus: ConstitutionalDecisionStatus,
  patch: Record<string, unknown>,
  eventType: DecisionEventName,
  eventPayloadExtra: Record<string, unknown> = {},
): Promise<DecisionResult<DecisionRecord>> {
  const current = await getDecisionInternal(decisionId, workspaceId);
  if (!current.ok) return current;

  const transition = validateDecisionTransition(current.data.status, targetStatus);
  if (!transition.ok) return decisionTransitionValidationFailure(transition.error);

  const now = new Date().toISOString();
  const supabase = await createSupabaseServerClient();

  const { data: updated, error } = await supabase
    .from("constitutional_decisions")
    .update({ ...patch, status: targetStatus, updated_at: now })
    .eq("id", decisionId)
    .eq("workspace_id", workspaceId)
    .select(decisionColumns)
    .single<DecisionRecord>();

  if (error || !updated)
    return failed(`Unable to transition constitutional decision to '${targetStatus}'.`);

  return emitDecisionEvent(updated, eventType, actorId, {
    decisionId: updated.id,
    constitutionId: updated.constitution_id,
    fromStatus: current.data.status,
    toStatus: targetStatus,
    ...eventPayloadExtra,
  });
}

// ─── createConstitutionalDecision ─────────────────────────────────────────────

export async function createConstitutionalDecision(
  input: CreateDecisionInput,
): Promise<DecisionResult<DecisionRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.constitutionId)) return validation("constitutionId must be a UUID.");
  if (!validUuid(input.createdBy)) return validation("createdBy must be a UUID.");
  if (!required(input.title)) return validation("title is required.");
  if (!required(input.decisionType)) return validation("decisionType is required.");
  if (!required(input.decisionAuthority)) return validation("decisionAuthority is required.");

  const constitutionCheck = await getConstitution(input.constitutionId, input.workspaceId);
  if (!constitutionCheck.ok) return constitutionCheck;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_decisions")
    .insert({
      workspace_id: input.workspaceId,
      constitution_id: input.constitutionId,
      title: input.title.trim(),
      description: input.description ?? null,
      decision_type: input.decisionType,
      context: input.context ?? null,
      problem_statement: input.problemStatement ?? null,
      recommended_option: input.recommendedOption ?? null,
      decision_authority: input.decisionAuthority,
      status: "draft" as ConstitutionalDecisionStatus,
      created_by: input.createdBy,
    })
    .select(decisionColumns)
    .single<DecisionRecord>();

  if (error || !data) return failed("Unable to create constitutional decision.");

  return emitDecisionEvent(data, "CONSTITUTIONAL_DECISION_CREATED", input.createdBy, {
    decisionId: data.id,
    constitutionId: data.constitution_id,
    title: data.title,
    decisionType: data.decision_type,
    decisionAuthority: data.decision_authority,
  });
}

// ─── updateConstitutionalDecision ─────────────────────────────────────────────

export async function updateConstitutionalDecision(
  input: UpdateDecisionInput,
): Promise<DecisionResult<DecisionRecord>> {
  if (!validUuid(input.decisionId)) return validation("decisionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const current = await getDecisionInternal(input.decisionId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.status !== "draft") {
    return failed(
      `Constitutional decision in status '${current.data.status}' cannot be edited; only draft decisions are editable.`,
      "governance_violation",
    );
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) {
    if (!required(input.title)) return validation("title cannot be empty.");
    patch.title = input.title.trim();
  }
  if (input.description !== undefined) patch.description = input.description;
  if (input.context !== undefined) patch.context = input.context;
  if (input.problemStatement !== undefined) patch.problem_statement = input.problemStatement;
  if (input.recommendedOption !== undefined) patch.recommended_option = input.recommendedOption;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_decisions")
    .update(patch)
    .eq("id", input.decisionId)
    .eq("workspace_id", input.workspaceId)
    .select(decisionColumns)
    .single<DecisionRecord>();

  if (error || !data) return failed("Unable to update constitutional decision.");

  return emitDecisionEvent(data, "CONSTITUTIONAL_DECISION_UPDATED", input.actorId, {
    decisionId: data.id,
    constitutionId: data.constitution_id,
    updatedFields: Object.keys(patch).filter((k) => k !== "updated_at"),
  });
}

// ─── addDecisionOption ────────────────────────────────────────────────────────

export async function addDecisionOption(
  input: AddDecisionOptionInput,
): Promise<DecisionResult<DecisionOptionRecord>> {
  if (!validUuid(input.decisionId)) return validation("decisionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
  if (!required(input.name)) return validation("name is required.");

  const decisionCheck = await getDecisionInternal(input.decisionId, input.workspaceId);
  if (!decisionCheck.ok) return decisionCheck;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_decision_options")
    .insert({
      workspace_id: input.workspaceId,
      decision_id: input.decisionId,
      name: input.name.trim(),
      description: input.description ?? null,
      advantages: input.advantages ?? null,
      disadvantages: input.disadvantages ?? null,
      estimated_cost: input.estimatedCost ?? null,
      estimated_effort: input.estimatedEffort ?? null,
      selected: false,
    })
    .select(optionColumns)
    .single<DecisionOptionRecord>();

  if (error || !data) return failed("Unable to add decision option.");

  const event = await createPlatformEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    actorType: "user",
    eventType: "CONSTITUTIONAL_DECISION_OPTION_ADDED",
    eventCategory: "governance",
    source: "user_action",
    correlationId: input.decisionId,
    causationId: null,
    rawReferenceTable: "constitutional_decision_options",
    rawReferenceId: data.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: { decisionId: input.decisionId, optionId: data.id, optionName: data.name },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data };
}

// ─── selectDecisionOption ─────────────────────────────────────────────────────

export async function selectDecisionOption(
  input: SelectDecisionOptionInput,
): Promise<DecisionResult<DecisionOptionRecord>> {
  if (!validUuid(input.decisionId)) return validation("decisionId must be a UUID.");
  if (!validUuid(input.optionId)) return validation("optionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const decisionCheck = await getDecisionInternal(input.decisionId, input.workspaceId);
  if (!decisionCheck.ok) return decisionCheck;

  const supabase = await createSupabaseServerClient();

  // Deselect all options for this decision
  const { error: deselectError } = await supabase
    .from("constitutional_decision_options")
    .update({ selected: false })
    .eq("decision_id", input.decisionId)
    .eq("workspace_id", input.workspaceId);

  if (deselectError) return failed("Unable to deselect previous options.");

  // Select the target option
  const { data, error } = await supabase
    .from("constitutional_decision_options")
    .update({ selected: true })
    .eq("id", input.optionId)
    .eq("decision_id", input.decisionId)
    .eq("workspace_id", input.workspaceId)
    .select(optionColumns)
    .single<DecisionOptionRecord>();

  if (error || !data) return failed("Unable to select decision option.", "not_found");

  // Update the decision's selected_option field
  const { error: decisionUpdateError } = await supabase
    .from("constitutional_decisions")
    .update({ selected_option: data.name, updated_at: new Date().toISOString() })
    .eq("id", input.decisionId)
    .eq("workspace_id", input.workspaceId);

  if (decisionUpdateError) return failed("Unable to update decision selected option.");

  const event = await createPlatformEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    actorType: "user",
    eventType: "CONSTITUTIONAL_DECISION_OPTION_SELECTED",
    eventCategory: "governance",
    source: "user_action",
    correlationId: input.decisionId,
    causationId: null,
    rawReferenceTable: "constitutional_decision_options",
    rawReferenceId: data.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: { decisionId: input.decisionId, optionId: data.id, optionName: data.name },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data };
}

// ─── attachDecisionEvidence ───────────────────────────────────────────────────

export async function attachDecisionEvidence(
  input: AttachDecisionEvidenceInput,
): Promise<DecisionResult<DecisionEvidenceRecord>> {
  if (!validUuid(input.decisionId)) return validation("decisionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
  if (!required(input.evidenceType)) return validation("evidenceType is required.");
  if (!required(input.description)) return validation("description is required.");

  const decisionCheck = await getDecisionInternal(input.decisionId, input.workspaceId);
  if (!decisionCheck.ok) return decisionCheck;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_decision_evidence")
    .insert({
      workspace_id: input.workspaceId,
      decision_id: input.decisionId,
      evidence_type: input.evidenceType,
      reference_id: input.referenceId ?? null,
      description: input.description.trim(),
      created_by: input.actorId,
    })
    .select(evidenceColumns)
    .single<DecisionEvidenceRecord>();

  if (error || !data) return failed("Unable to attach decision evidence.");

  const event = await createPlatformEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    actorType: "user",
    eventType: "CONSTITUTIONAL_DECISION_EVIDENCE_ATTACHED",
    eventCategory: "governance",
    source: "user_action",
    correlationId: input.decisionId,
    causationId: null,
    rawReferenceTable: "constitutional_decision_evidence",
    rawReferenceId: data.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      decisionId: input.decisionId,
      evidenceId: data.id,
      evidenceType: data.evidence_type,
    },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data };
}

// ─── linkDecisionEntity ───────────────────────────────────────────────────────

export async function linkDecisionEntity(
  input: LinkDecisionEntityInput,
): Promise<DecisionResult<DecisionLinkRecord>> {
  if (!validUuid(input.decisionId)) return validation("decisionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
  if (!validUuid(input.linkedEntityId)) return validation("linkedEntityId must be a UUID.");
  if (!required(input.linkType)) return validation("linkType is required.");

  const decisionCheck = await getDecisionInternal(input.decisionId, input.workspaceId);
  if (!decisionCheck.ok) return decisionCheck;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_decision_links")
    .insert({
      workspace_id: input.workspaceId,
      decision_id: input.decisionId,
      link_type: input.linkType,
      linked_entity_id: input.linkedEntityId,
    })
    .select(linkColumns)
    .single<DecisionLinkRecord>();

  if (error || !data) return failed("Unable to create decision link.");

  const event = await createPlatformEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    actorType: "user",
    eventType: "CONSTITUTIONAL_DECISION_LINK_CREATED",
    eventCategory: "governance",
    source: "user_action",
    correlationId: input.decisionId,
    causationId: null,
    rawReferenceTable: "constitutional_decision_links",
    rawReferenceId: data.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      decisionId: input.decisionId,
      linkId: data.id,
      linkType: data.link_type,
      linkedEntityId: data.linked_entity_id,
    },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data };
}

// ─── proposeDecision ──────────────────────────────────────────────────────────

export async function proposeDecision(
  input: ProposeDecisionInput,
): Promise<DecisionResult<DecisionRecord>> {
  if (!validUuid(input.decisionId)) return validation("decisionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  return transitionDecision(
    input.decisionId,
    input.workspaceId,
    input.actorId,
    "proposed",
    {},
    "CONSTITUTIONAL_DECISION_PROPOSED",
  );
}

// ─── approveDecision ──────────────────────────────────────────────────────────

export async function approveDecision(
  input: ApproveDecisionInput,
): Promise<DecisionResult<DecisionRecord>> {
  if (!validUuid(input.decisionId)) return validation("decisionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  // Rule 12: Must have a selected option before approval
  const current = await getDecisionInternal(input.decisionId, input.workspaceId);
  if (!current.ok) return current;

  const supabase = await createSupabaseServerClient();
  const { data: options, error: optionsError } = await supabase
    .from("constitutional_decision_options")
    .select("id,selected")
    .eq("decision_id", input.decisionId)
    .eq("workspace_id", input.workspaceId)
    .eq("selected", true);

  if (optionsError) return failed("Unable to verify decision options.");
  if (!options || options.length === 0) {
    return failed(
      "Cannot approve a constitutional decision without a selected option.",
      "governance_violation",
    );
  }

  return transitionDecision(
    input.decisionId,
    input.workspaceId,
    input.actorId,
    "approved",
    { approved_by: input.actorId, approved_at: new Date().toISOString() },
    "CONSTITUTIONAL_DECISION_APPROVED",
  );
}

// ─── rejectDecision ───────────────────────────────────────────────────────────

export async function rejectDecision(
  input: RejectDecisionInput,
): Promise<DecisionResult<DecisionRecord>> {
  if (!validUuid(input.decisionId)) return validation("decisionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  return transitionDecision(
    input.decisionId,
    input.workspaceId,
    input.actorId,
    "rejected",
    {},
    "CONSTITUTIONAL_DECISION_REJECTED",
  );
}

// ─── executeDecision ──────────────────────────────────────────────────────────

export async function executeDecision(
  input: ExecuteDecisionInput,
): Promise<DecisionResult<DecisionRecord>> {
  if (!validUuid(input.decisionId)) return validation("decisionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  return transitionDecision(
    input.decisionId,
    input.workspaceId,
    input.actorId,
    "executed",
    { executed_by: input.actorId, executed_at: new Date().toISOString() },
    "CONSTITUTIONAL_DECISION_EXECUTED",
  );
}

// ─── cancelDecision ───────────────────────────────────────────────────────────

export async function cancelDecision(
  input: CancelDecisionInput,
): Promise<DecisionResult<DecisionRecord>> {
  if (!validUuid(input.decisionId)) return validation("decisionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const current = await getDecisionInternal(input.decisionId, input.workspaceId);
  if (!current.ok) return current;

  if (DECISION_TERMINAL_STATES.has(current.data.status)) {
    return failed(
      `Constitutional decision in terminal status '${current.data.status}' cannot be cancelled.`,
      "governance_violation",
    );
  }

  return transitionDecision(
    input.decisionId,
    input.workspaceId,
    input.actorId,
    "cancelled",
    { cancelled_by: input.actorId, cancelled_at: new Date().toISOString() },
    "CONSTITUTIONAL_DECISION_CANCELLED",
  );
}

// ─── listConstitutionalDecisions ─────────────────────────────────────────────

export async function listConstitutionalDecisions(
  input: ListDecisionsInput,
): Promise<DecisionResult<DecisionRecord[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (input.constitutionId && !validUuid(input.constitutionId))
    return validation("constitutionId must be a UUID.");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("constitutional_decisions")
    .select(decisionColumns)
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null);

  if (input.constitutionId) query = query.eq("constitution_id", input.constitutionId);
  if (input.status) query = query.eq("status", input.status);
  if (input.decisionType) query = query.eq("decision_type", input.decisionType);
  if (input.decisionAuthority) query = query.eq("decision_authority", input.decisionAuthority);
  if (input.fromDate) query = query.gte("created_at", input.fromDate);
  if (input.toDate) query = query.lte("created_at", input.toDate);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return failed("Unable to list constitutional decisions.");
  return { ok: true, data: (data ?? []) as DecisionRecord[] };
}

// ─── getDecisionTimeline ──────────────────────────────────────────────────────

export async function getDecisionTimeline(input: {
  decisionId: string;
  workspaceId: string;
}): Promise<DecisionResult<import("./decision-types").DecisionTimelineEntry[]>> {
  if (!validUuid(input.decisionId)) return validation("decisionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");

  const decision = await getDecisionInternal(input.decisionId, input.workspaceId);
  if (!decision.ok) return decision;

  const d = decision.data;
  const entries: import("./decision-types").DecisionTimelineEntry[] = [];

  entries.push({
    date: d.created_at,
    actor: d.created_by,
    action: "created",
    status: "draft",
    comment: null,
  });

  if (d.approved_at) {
    entries.push({
      date: d.approved_at,
      actor: d.approved_by,
      action: "approved",
      status: "approved",
      comment: null,
    });
  }

  if (d.executed_at) {
    entries.push({
      date: d.executed_at,
      actor: d.executed_by,
      action: "executed",
      status: "executed",
      comment: null,
    });
  }

  if (d.cancelled_at) {
    entries.push({
      date: d.cancelled_at,
      actor: d.cancelled_by,
      action: "cancelled",
      status: "cancelled",
      comment: null,
    });
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));

  return { ok: true, data: entries };
}

// ─── traceDecisionLineage ─────────────────────────────────────────────────────

export async function traceDecisionLineage(input: {
  decisionId: string;
  workspaceId: string;
}): Promise<DecisionResult<import("./decision-types").DecisionLineage>> {
  if (!validUuid(input.decisionId)) return validation("decisionId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");

  const decision = await getDecisionInternal(input.decisionId, input.workspaceId);
  if (!decision.ok) return decision;

  const supabase = await createSupabaseServerClient();

  const [optionsResult, evidenceResult, linksResult] = await Promise.all([
    supabase
      .from("constitutional_decision_options")
      .select(optionColumns)
      .eq("decision_id", input.decisionId)
      .eq("workspace_id", input.workspaceId)
      .order("created_at", { ascending: true }),
    supabase
      .from("constitutional_decision_evidence")
      .select(evidenceColumns)
      .eq("decision_id", input.decisionId)
      .eq("workspace_id", input.workspaceId)
      .order("created_at", { ascending: true }),
    supabase
      .from("constitutional_decision_links")
      .select(linkColumns)
      .eq("decision_id", input.decisionId)
      .eq("workspace_id", input.workspaceId)
      .order("created_at", { ascending: true }),
  ]);

  if (optionsResult.error) return failed("Unable to retrieve decision options.");
  if (evidenceResult.error) return failed("Unable to retrieve decision evidence.");
  if (linksResult.error) return failed("Unable to retrieve decision links.");

  const timelineResult = await getDecisionTimeline(input);
  if (!timelineResult.ok) return timelineResult;

  return {
    ok: true,
    data: {
      decision: decision.data,
      options: (optionsResult.data ?? []) as DecisionOptionRecord[],
      evidence: (evidenceResult.data ?? []) as DecisionEvidenceRecord[],
      links: (linksResult.data ?? []) as DecisionLinkRecord[],
      timeline: timelineResult.data,
    },
  };
}

export { explainConstitutionalDecisionGovernance } from "./decision-explanation";
export { generateDecisionImpactAnalysis } from "./decision-impact-analysis";
export { generateAmendmentFromDecision } from "./decision-amendment-integration";
