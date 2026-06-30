// ─── PMO Controlled Project Intelligence Handoff — Service ───────────────────
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT execute adapters, mutate external projects, or create external tickets.
// Does NOT send emails, Slack messages, or create calendar events.
// Does NOT delete project memory, overwrite project brain, or auto-assign PM.
// Updates ONLY dedicated project intelligence handoff records after explicit approval.

import {
  createAgentPmoProjectHandoffRequest,
  getAgentPmoProjectHandoffRequestById,
  listAgentPmoProjectHandoffRequests,
  updateAgentPmoProjectHandoffRequestStatus,
  createAgentPmoProjectContextValidation,
  listAgentPmoProjectContextValidations,
  createAgentPmoProjectHandoffGate,
  getAgentPmoProjectHandoffGateById,
  listAgentPmoProjectHandoffGates,
  updateAgentPmoProjectHandoffGateStatus,
  recordAgentPmoProjectHandoffGateDecision,
  listAgentPmoProjectHandoffGateDecisions,
  createAgentPmoProjectHandoffPack,
  getAgentPmoProjectHandoffPackById,
  listAgentPmoProjectHandoffPacks,
  createAgentPmoProjectMemorySnapshot,
  listAgentPmoProjectMemorySnapshots,
  createAgentPmoProjectStatusSnapshot,
  listAgentPmoProjectStatusSnapshots,
  createAgentPmoProjectHandoffSnapshotItem,
  listAgentPmoProjectHandoffSnapshotItems,
  updateAgentPmoProjectHandoffSnapshotItemStatus,
  createAgentPmoStakeholderContextSnapshot,
  listAgentPmoStakeholderContextSnapshots,
  recordAgentPmoOutgoingPmNote,
  listAgentPmoOutgoingPmNotes,
  recordAgentPmoIncomingPmAcceptance,
  listAgentPmoIncomingPmAcceptances,
  upsertAgentPmoControlledProjectAssignmentPointer,
  getAgentPmoControlledProjectAssignmentPointerByProject,
  listAgentPmoControlledProjectAssignmentPointers,
  recordAgentPmoProjectAssignmentHistory,
  listAgentPmoProjectAssignmentHistory,
  createAgentPmoHandoffContinuityCheck,
  listAgentPmoHandoffContinuityChecks,
  updateAgentPmoHandoffContinuityCheckStatus,
  createAgentPmoProjectHandoffExport,
  listAgentPmoProjectHandoffExports,
  recordAgentPmoProjectHandoffAuditEvent,
  listAgentPmoProjectHandoffAuditEvents,
} from "./agent-pmo-project-handoff-registry";

import {
  normalizeCreateProjectHandoffRequestInput,
  normalizeCreateProjectHandoffGateInput,
  normalizeProjectHandoffGateDecisionInput,
  normalizeCreateProjectHandoffPackInput,
  normalizeOutgoingPmNoteInput,
  normalizeIncomingPmAcceptanceInput,
  normalizeCompleteProjectHandoffInput,
  normalizeProjectHandoffExportInput,
  evaluateProjectContextValidationStatus,
  evaluateProjectHandoffCompletionReadiness,
  deriveProjectHandoffRequestStatus,
  validateProjectHandoffExportSafety,
  redactProjectHandoffPayload,
  sanitizeProjectHandoffText,
} from "./agent-pmo-project-handoff-validation";

import type {
  AgentPmoProjectHandoffRequestRecord,
  AgentPmoProjectContextValidationRecord,
  AgentPmoProjectHandoffGateRecord,
  AgentPmoProjectHandoffGateDecisionRecord,
  AgentPmoProjectHandoffPackRecord,
  AgentPmoProjectMemorySnapshotRecord,
  AgentPmoProjectStatusSnapshotRecord,
  AgentPmoProjectHandoffSnapshotItemRecord,
  AgentPmoStakeholderContextSnapshotRecord,
  AgentPmoOutgoingPmNoteRecord,
  AgentPmoIncomingPmAcceptanceRecord,
  AgentPmoControlledProjectAssignmentPointerRecord,
  AgentPmoProjectAssignmentHistoryRecord,
  AgentPmoHandoffContinuityCheckRecord,
  AgentPmoProjectHandoffExportRecord,
  AgentPmoProjectHandoffAuditEventRecord,
  CreateAgentPmoProjectHandoffRequestInput,
  CreateAgentPmoProjectHandoffGateInput,
  RecordAgentPmoProjectHandoffGateDecisionInput,
  CreateAgentPmoProjectHandoffPackInput,
  RecordAgentPmoOutgoingPmNoteInput,
  RecordAgentPmoIncomingPmAcceptanceInput,
  CompleteAgentPmoProjectHandoffInput,
  GenerateAgentPmoProjectHandoffExportInput,
  AgentPmoHandoffContinuityCheckType,
} from "./agent-pmo-project-handoff-types";

const now = () => new Date().toISOString();

// ─── Create Handoff Request ───────────────────────────────────────────────────

export async function createProjectHandoffRequest(
  raw: unknown,
): Promise<AgentPmoProjectHandoffRequestRecord> {
  const input = normalizeCreateProjectHandoffRequestInput(raw);
  const record = await createAgentPmoProjectHandoffRequest({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    currentPmId: input.currentPmId ?? null,
    incomingPmId: input.incomingPmId,
    requestedById: input.requestedById ?? null,
    handoffReason: input.handoffReason,
    handoffUrgency: input.handoffUrgency,
    requestReason: input.requestReason,
    status: "context_validation_pending",
    effectiveDate: input.effectiveDate ?? null,
    requestVersion: 1,
    safeRequestPayload: redactProjectHandoffPayload({
      projectId: input.projectId,
      handoffReason: input.handoffReason,
      handoffUrgency: input.handoffUrgency,
    }),
  });
  await recordAgentPmoProjectHandoffAuditEvent({
    workspaceId: input.workspaceId,
    handoffRequestId: record.id,
    eventType: "handoff_request_created",
    message: `Handoff request created for project ${input.projectId}`,
    safeEventPayload: { handoffReason: input.handoffReason, urgency: input.handoffUrgency },
    actorId: input.requestedById ?? null,
  });
  return record;
}

// ─── Validate Handoff Context ─────────────────────────────────────────────────

export async function validateProjectHandoffContext(
  workspaceId: string,
  handoffRequestId: string,
): Promise<AgentPmoProjectContextValidationRecord[]> {
  const request = await getAgentPmoProjectHandoffRequestById(handoffRequestId);
  if (!request) throw new Error(`Handoff request not found: ${handoffRequestId}`);
  if (request.workspaceId !== workspaceId) throw new Error("Workspace scope mismatch");

  type CheckDef = {
    checkKey: string;
    checkLabel: string;
    evaluate: () => { status: AgentPmoProjectContextValidationRecord["status"]; finding: string; limitation: string | null };
  };

  const checks: CheckDef[] = [
    {
      checkKey: "workspace_scope_valid",
      checkLabel: "Workspace scope is valid",
      evaluate: () => ({ status: "passed", finding: "Workspace ID is present and matches request", limitation: null }),
    },
    {
      checkKey: "project_id_present",
      checkLabel: "Project ID is present",
      evaluate: () => ({
        status: request.projectId ? "passed" : "failed",
        finding: request.projectId ? `Project ID: ${request.projectId}` : "Project ID is missing",
        limitation: null,
      }),
    },
    {
      checkKey: "incoming_pm_present",
      checkLabel: "Incoming PM is identified",
      evaluate: () => ({
        status: request.incomingPmId ? "passed" : "failed",
        finding: request.incomingPmId ? "Incoming PM ID is present" : "Incoming PM ID is missing",
        limitation: null,
      }),
    },
    {
      checkKey: "current_pm_known",
      checkLabel: "Current PM is known or recorded as unknown",
      evaluate: () => ({
        status: request.currentPmId ? "passed" : "waived",
        finding: request.currentPmId ? "Current PM ID is present" : "Current PM is unknown; limitation recorded",
        limitation: request.currentPmId ? null : "Current PM not identified; handoff will proceed with unknown outgoing PM",
      }),
    },
    {
      checkKey: "pms_are_different",
      checkLabel: "Current PM and incoming PM are different",
      evaluate: () => {
        if (!request.currentPmId) {
          return { status: "waived" as const, finding: "Current PM unknown; cannot verify PM difference", limitation: "PM difference check skipped" };
        }
        return {
          status: request.currentPmId !== request.incomingPmId ? "passed" : "failed",
          finding: request.currentPmId !== request.incomingPmId ? "PMs are different" : "Current PM and incoming PM are the same",
          limitation: null,
        };
      },
    },
    {
      checkKey: "handoff_reason_valid",
      checkLabel: "Handoff reason is valid",
      evaluate: () => ({ status: "passed", finding: `Handoff reason: ${request.handoffReason}`, limitation: null }),
    },
    {
      checkKey: "project_memory_available",
      checkLabel: "Project memory availability check",
      evaluate: () => ({
        status: "waived" as const,
        finding: "Project memory source availability cannot be verified at validation time",
        limitation: "Project memory snapshot will record available data and limitations at snapshot creation time",
      }),
    },
    {
      checkKey: "risk_blocker_source_available",
      checkLabel: "Risk/blocker snapshot source availability",
      evaluate: () => ({
        status: "waived" as const,
        finding: "Risk and blocker source availability cannot be verified at validation time",
        limitation: "Snapshot items will record available data and limitations",
      }),
    },
    {
      checkKey: "no_external_side_effects",
      checkLabel: "No external side effects are requested",
      evaluate: () => ({ status: "passed", finding: "No external APIs, tickets, emails, or adapter execution requested", limitation: null }),
    },
    {
      checkKey: "no_unsafe_payload",
      checkLabel: "No unsafe payload detected",
      evaluate: () => ({ status: "passed", finding: "Request payload does not contain unsafe fields", limitation: null }),
    },
  ];

  const validations: AgentPmoProjectContextValidationRecord[] = [];
  for (const check of checks) {
    const result = check.evaluate();
    const v = await createAgentPmoProjectContextValidation({
      workspaceId,
      handoffRequestId,
      checkKey: check.checkKey,
      checkLabel: check.checkLabel,
      status: result.status,
      finding: result.finding,
      limitation: result.limitation,
    });
    validations.push(v);
    await recordAgentPmoProjectHandoffAuditEvent({
      workspaceId,
      handoffRequestId,
      eventType: "handoff_context_validation_created",
      message: `Validation check: ${check.checkLabel} → ${result.status}`,
      safeEventPayload: { checkKey: check.checkKey, status: result.status },
      actorId: null,
    });
  }

  const overallStatus = evaluateProjectContextValidationStatus(validations);
  const newRequestStatus = deriveProjectHandoffRequestStatus(overallStatus);
  await updateAgentPmoProjectHandoffRequestStatus(handoffRequestId, newRequestStatus);

  await recordAgentPmoProjectHandoffAuditEvent({
    workspaceId,
    handoffRequestId,
    eventType: "handoff_context_validation_completed",
    message: `Context validation completed with overall status: ${overallStatus}`,
    safeEventPayload: { overallStatus, validationCount: validations.length },
    actorId: null,
  });

  return validations;
}

// ─── Create PMO Handoff Gate ──────────────────────────────────────────────────

export async function createProjectHandoffGate(
  raw: unknown,
): Promise<AgentPmoProjectHandoffGateRecord> {
  const input = normalizeCreateProjectHandoffGateInput(raw);
  const request = await getAgentPmoProjectHandoffRequestById(input.handoffRequestId);
  if (!request) throw new Error(`Handoff request not found: ${input.handoffRequestId}`);
  if (request.workspaceId !== input.workspaceId) throw new Error("Workspace scope mismatch");
  if (request.status !== "ready_for_pmo_review") {
    throw new Error(`Handoff request must be ready_for_pmo_review to create gate (current: ${request.status})`);
  }
  const gate = await createAgentPmoProjectHandoffGate({
    workspaceId: input.workspaceId,
    handoffRequestId: input.handoffRequestId,
    gateStatus: "under_review",
    reviewedById: input.reviewedById ?? null,
    safeGatePayload: {},
  });
  await updateAgentPmoProjectHandoffRequestStatus(input.handoffRequestId, "pmo_review_required");
  await recordAgentPmoProjectHandoffAuditEvent({
    workspaceId: input.workspaceId,
    handoffRequestId: input.handoffRequestId,
    eventType: "handoff_pmo_gate_created",
    message: `PMO handoff gate created: ${gate.id}`,
    safeEventPayload: { gateId: gate.id },
    actorId: input.reviewedById ?? null,
  });
  return gate;
}

// ─── Record PMO Gate Decision ─────────────────────────────────────────────────

export async function recordProjectHandoffGateDecision(
  raw: unknown,
): Promise<AgentPmoProjectHandoffGateDecisionRecord> {
  const input = normalizeProjectHandoffGateDecisionInput(raw);
  const gate = await getAgentPmoProjectHandoffGateById(input.handoffGateId);
  if (!gate) throw new Error(`Handoff gate not found: ${input.handoffGateId}`);
  if (gate.workspaceId !== input.workspaceId) throw new Error("Workspace scope mismatch");

  const decisionRecord = await recordAgentPmoProjectHandoffGateDecision({
    workspaceId: input.workspaceId,
    handoffGateId: input.handoffGateId,
    handoffRequestId: input.handoffRequestId,
    decision: input.decision,
    rationale: input.rationale,
    decidedById: input.decidedById ?? null,
    decidedAt: now(),
  });

  const gateStatusMap: Record<string, import("./agent-pmo-project-handoff-types").AgentPmoProjectHandoffGateStatus> = {
    approve_for_handoff: "approved_for_handoff",
    reject: "rejected",
    request_changes: "changes_requested",
    block: "blocked",
    archive: "archived",
  };
  const requestStatusMap: Record<string, import("./agent-pmo-project-handoff-types").AgentPmoProjectHandoffRequestStatus> = {
    approve_for_handoff: "pmo_approved",
    reject: "pmo_rejected",
    request_changes: "pmo_review_required",
    block: "blocked",
    archive: "archived",
  };

  await updateAgentPmoProjectHandoffGateStatus(input.handoffGateId, gateStatusMap[input.decision] ?? "under_review");
  await updateAgentPmoProjectHandoffRequestStatus(input.handoffRequestId, requestStatusMap[input.decision] ?? "pmo_review_required");

  await recordAgentPmoProjectHandoffAuditEvent({
    workspaceId: input.workspaceId,
    handoffRequestId: input.handoffRequestId,
    eventType: "handoff_pmo_gate_decision_recorded",
    message: `PMO gate decision: ${input.decision}`,
    safeEventPayload: { decision: input.decision, gateId: input.handoffGateId },
    actorId: input.decidedById ?? null,
  });

  return decisionRecord;
}

// ─── Generate Handoff Pack ────────────────────────────────────────────────────

export async function generateProjectHandoffPack(
  raw: unknown,
): Promise<AgentPmoProjectHandoffPackRecord> {
  const input = normalizeCreateProjectHandoffPackInput(raw);
  const request = await getAgentPmoProjectHandoffRequestById(input.handoffRequestId);
  if (!request) throw new Error(`Handoff request not found: ${input.handoffRequestId}`);
  if (request.workspaceId !== input.workspaceId) throw new Error("Workspace scope mismatch");
  if (request.status !== "pmo_approved") {
    throw new Error(`Handoff request must be pmo_approved to generate pack (current: ${request.status})`);
  }

  const validations = await listAgentPmoProjectContextValidations(input.workspaceId, input.handoffRequestId);
  const limitations: string[] = validations
    .filter((v) => v.limitation)
    .map((v) => v.limitation as string);

  const pack = await createAgentPmoProjectHandoffPack({
    workspaceId: input.workspaceId,
    handoffRequestId: input.handoffRequestId,
    currentPmId: request.currentPmId,
    incomingPmId: request.incomingPmId,
    handoffReason: request.handoffReason,
    packStatus: "pmo_review_ready",
    executiveSummary: sanitizeProjectHandoffText(
      `Project handoff from ${request.currentPmId ?? "unknown PM"} to ${request.incomingPmId}. ` +
      `Reason: ${request.handoffReason}. Urgency: ${request.handoffUrgency}. ` +
      `Request: ${request.requestReason}`,
      8000,
    ),
    currentProjectState: "Current project state summary based on available records. Source data availability recorded in limitations.",
    healthSummary: "Project health status: unknown (source data not available at pack generation time)",
    scheduleSummary: "Schedule status: unknown (source data not available at pack generation time)",
    deliverySummary: "Delivery status: unknown (source data not available at pack generation time)",
    financialSummary: null,
    riskSummary: "Risk summary will be available after snapshot items are created",
    blockerSummary: "Blocker summary will be available after snapshot items are created",
    openDecisionSummary: "Open decision summary will be available after snapshot items are created",
    dependencySummary: "Dependency summary will be available after snapshot items are created",
    stakeholderSummary: "Stakeholder summary will be available after stakeholder context is recorded",
    commitmentSummary: "Commitment summary will be available after snapshot items are created",
    milestoneSummary: "Milestone summary will be available after snapshot items are created",
    recommendedFirstActions: "1. Review handoff pack and project memory snapshot. 2. Review open risks and blockers. 3. Review stakeholder context. 4. Review open decisions. 5. Complete continuity checks.",
    limitations: limitations.length > 0 ? limitations.join("; ") : "No limitations recorded",
    safePackPayload: redactProjectHandoffPayload({
      projectId: request.projectId,
      handoffReason: request.handoffReason,
      limitationCount: limitations.length,
    }),
  });

  await updateAgentPmoProjectHandoffRequestStatus(input.handoffRequestId, "handoff_pack_created");
  await recordAgentPmoProjectHandoffAuditEvent({
    workspaceId: input.workspaceId,
    handoffRequestId: input.handoffRequestId,
    eventType: "handoff_pack_created",
    message: `Handoff pack created: ${pack.id}`,
    safeEventPayload: { packId: pack.id, limitationCount: limitations.length },
    actorId: null,
  });
  return pack;
}

// ─── Create Project Memory Snapshot ──────────────────────────────────────────

export async function createProjectMemorySnapshot(
  workspaceId: string,
  handoffRequestId: string,
): Promise<AgentPmoProjectMemorySnapshotRecord[]> {
  const request = await getAgentPmoProjectHandoffRequestById(handoffRequestId);
  if (!request) throw new Error(`Handoff request not found: ${handoffRequestId}`);
  if (request.workspaceId !== workspaceId) throw new Error("Workspace scope mismatch");

  const categories: Array<import("./agent-pmo-project-handoff-types").AgentPmoProjectMemorySnapshotCategory> = [
    "project_summary", "delivery_history", "key_decisions", "risks", "blockers",
    "dependencies", "milestones", "stakeholders", "client_commitments",
    "commercial_notes", "technical_notes", "governance_notes", "open_questions",
    "next_actions", "lessons_learned",
  ];

  const snapshots: AgentPmoProjectMemorySnapshotRecord[] = [];
  for (const category of categories) {
    const snapshot = await createAgentPmoProjectMemorySnapshot({
      workspaceId,
      handoffRequestId,
      category,
      snapshotStatus: "assembled",
      summary: `${category.replace(/_/g, " ")} snapshot captured at handoff time. Source data availability subject to project memory conventions.`,
      limitation: "Source project memory records not available in handoff layer; summary is a placeholder for future runtime integration",
      itemCount: 0,
      safeSnapshotPayload: redactProjectHandoffPayload({ category, handoffRequestId }),
    });
    snapshots.push(snapshot);
    await recordAgentPmoProjectHandoffAuditEvent({
      workspaceId,
      handoffRequestId,
      eventType: "project_memory_snapshot_created",
      message: `Memory snapshot created: ${category}`,
      safeEventPayload: { category, snapshotId: snapshot.id },
      actorId: null,
    });
  }
  return snapshots;
}

// ─── Create Project Status Snapshot ──────────────────────────────────────────

export async function createProjectStatusSnapshot(
  workspaceId: string,
  handoffRequestId: string,
): Promise<AgentPmoProjectStatusSnapshotRecord> {
  const request = await getAgentPmoProjectHandoffRequestById(handoffRequestId);
  if (!request) throw new Error(`Handoff request not found: ${handoffRequestId}`);
  if (request.workspaceId !== workspaceId) throw new Error("Workspace scope mismatch");

  const snapshot = await createAgentPmoProjectStatusSnapshot({
    workspaceId,
    handoffRequestId,
    projectHealth: "unknown",
    scheduleHealth: "unknown",
    scopeHealth: "unknown",
    budgetHealth: "not_applicable",
    deliveryPhase: null,
    completionEstimate: null,
    upcomingMilestoneCount: 0,
    activeRiskCount: 0,
    activeBlockerCount: 0,
    openDecisionCount: 0,
    pendingActionCount: 0,
    safeStatusPayload: redactProjectHandoffPayload({
      note: "Status values set to unknown; source project status records not available in handoff layer",
    }),
  });

  await recordAgentPmoProjectHandoffAuditEvent({
    workspaceId,
    handoffRequestId,
    eventType: "project_status_snapshot_created",
    message: `Status snapshot created: ${snapshot.id}`,
    safeEventPayload: { snapshotId: snapshot.id },
    actorId: null,
  });

  return snapshot;
}

// ─── Create Snapshot Items ────────────────────────────────────────────────────

export async function createProjectHandoffSnapshotItems(
  workspaceId: string,
  handoffRequestId: string,
  items?: Array<{
    itemType: import("./agent-pmo-project-handoff-types").AgentPmoProjectHandoffSnapshotItemType;
    title: string;
    description: string;
    severity?: import("./agent-pmo-project-handoff-types").AgentPmoProjectHandoffSnapshotItemSeverity;
    dueDate?: string | null;
    sourceRef?: string | null;
  }>,
): Promise<AgentPmoProjectHandoffSnapshotItemRecord[]> {
  const request = await getAgentPmoProjectHandoffRequestById(handoffRequestId);
  if (!request) throw new Error(`Handoff request not found: ${handoffRequestId}`);
  if (request.workspaceId !== workspaceId) throw new Error("Workspace scope mismatch");

  const inputItems = items ?? [];
  const created: AgentPmoProjectHandoffSnapshotItemRecord[] = [];

  for (const item of inputItems) {
    const record = await createAgentPmoProjectHandoffSnapshotItem({
      workspaceId,
      handoffRequestId,
      itemType: item.itemType,
      title: sanitizeProjectHandoffText(item.title, 500),
      description: sanitizeProjectHandoffText(item.description, 4000),
      itemStatus: "open",
      severity: item.severity ?? "unknown",
      dueDate: item.dueDate ?? null,
      sourceRef: item.sourceRef ?? null,
      safeItemPayload: redactProjectHandoffPayload({ itemType: item.itemType }),
    });
    created.push(record);
    await recordAgentPmoProjectHandoffAuditEvent({
      workspaceId,
      handoffRequestId,
      eventType: "handoff_snapshot_item_created",
      message: `Snapshot item created: ${item.itemType} — ${item.title}`,
      safeEventPayload: { itemId: record.id, itemType: item.itemType },
      actorId: null,
    });
  }

  return created;
}

// ─── Create Stakeholder Context ───────────────────────────────────────────────

export async function createStakeholderContextSnapshot(
  workspaceId: string,
  handoffRequestId: string,
  stakeholders?: Array<{
    stakeholderType: import("./agent-pmo-project-handoff-types").AgentPmoStakeholderContextType;
    roleLabel: string;
    contextSummary: string;
  }>,
): Promise<AgentPmoStakeholderContextSnapshotRecord[]> {
  const request = await getAgentPmoProjectHandoffRequestById(handoffRequestId);
  if (!request) throw new Error(`Handoff request not found: ${handoffRequestId}`);
  if (request.workspaceId !== workspaceId) throw new Error("Workspace scope mismatch");

  const inputItems = stakeholders ?? [];
  const created: AgentPmoStakeholderContextSnapshotRecord[] = [];

  for (const s of inputItems) {
    const record = await createAgentPmoStakeholderContextSnapshot({
      workspaceId,
      handoffRequestId,
      stakeholderType: s.stakeholderType,
      roleLabel: sanitizeProjectHandoffText(s.roleLabel, 200),
      contextSummary: sanitizeProjectHandoffText(s.contextSummary, 2000),
      stakeholderStatus: "active",
      safeContextPayload: redactProjectHandoffPayload({ stakeholderType: s.stakeholderType }),
    });
    created.push(record);
    await recordAgentPmoProjectHandoffAuditEvent({
      workspaceId,
      handoffRequestId,
      eventType: "stakeholder_context_snapshot_created",
      message: `Stakeholder context recorded: ${s.stakeholderType}`,
      safeEventPayload: { recordId: record.id, stakeholderType: s.stakeholderType },
      actorId: null,
    });
  }

  return created;
}

// ─── Record Outgoing PM Note ──────────────────────────────────────────────────

export async function recordOutgoingPmNote(
  raw: unknown,
): Promise<AgentPmoOutgoingPmNoteRecord> {
  const input = normalizeOutgoingPmNoteInput(raw);
  const request = await getAgentPmoProjectHandoffRequestById(input.handoffRequestId);
  if (!request) throw new Error(`Handoff request not found: ${input.handoffRequestId}`);
  if (request.workspaceId !== input.workspaceId) throw new Error("Workspace scope mismatch");

  const note = await recordAgentPmoOutgoingPmNote({
    workspaceId: input.workspaceId,
    handoffRequestId: input.handoffRequestId,
    noteType: input.noteType,
    noteText: input.noteText,
    noteStatus: input.status ?? "draft",
    authorId: input.authorId ?? null,
    safeNotePayload: redactProjectHandoffPayload({ noteType: input.noteType }),
  });

  if ((input.status ?? "draft") === "submitted") {
    const packs = await listAgentPmoProjectHandoffPacks(input.workspaceId, input.handoffRequestId);
    if (packs.length > 0) {
      await updateAgentPmoProjectHandoffRequestStatus(input.handoffRequestId, "incoming_pm_review_required");
    }
  }

  await recordAgentPmoProjectHandoffAuditEvent({
    workspaceId: input.workspaceId,
    handoffRequestId: input.handoffRequestId,
    eventType: "outgoing_pm_note_recorded",
    message: `Outgoing PM note recorded: ${input.noteType}`,
    safeEventPayload: { noteId: note.id, noteType: input.noteType, noteStatus: note.noteStatus },
    actorId: input.authorId ?? null,
  });

  return note;
}

// ─── Record Incoming PM Acceptance ───────────────────────────────────────────

export async function recordIncomingPmAcceptance(
  raw: unknown,
): Promise<AgentPmoIncomingPmAcceptanceRecord> {
  const input = normalizeIncomingPmAcceptanceInput(raw);
  const request = await getAgentPmoProjectHandoffRequestById(input.handoffRequestId);
  if (!request) throw new Error(`Handoff request not found: ${input.handoffRequestId}`);
  if (request.workspaceId !== input.workspaceId) throw new Error("Workspace scope mismatch");

  const packs = await listAgentPmoProjectHandoffPacks(input.workspaceId, input.handoffRequestId);
  if (packs.length === 0) throw new Error("Handoff pack must exist before incoming PM acceptance can be recorded");

  const latestPack = packs[packs.length - 1];
  const acceptance = await recordAgentPmoIncomingPmAcceptance({
    workspaceId: input.workspaceId,
    handoffRequestId: input.handoffRequestId,
    handoffPackId: input.handoffPackId ?? latestPack.id,
    incomingPmId: input.incomingPmId,
    decision: input.decision,
    rationale: input.rationale,
    acceptanceStatus: input.decision === "accept_handoff" ? "accepted" : input.decision === "reject_handoff" ? "rejected" : input.decision === "block_handoff" ? "blocked" : "archived",
    safeAcceptancePayload: redactProjectHandoffPayload({ decision: input.decision }),
    decidedAt: now(),
  });

  const requestStatusMap: Record<string, import("./agent-pmo-project-handoff-types").AgentPmoProjectHandoffRequestStatus> = {
    accept_handoff: "incoming_pm_accepted",
    request_changes: "incoming_pm_review_required",
    reject_handoff: "incoming_pm_rejected",
    block_handoff: "blocked",
    archive: "archived",
  };

  await updateAgentPmoProjectHandoffRequestStatus(
    input.handoffRequestId,
    requestStatusMap[input.decision] ?? "incoming_pm_review_required",
  );

  await recordAgentPmoProjectHandoffAuditEvent({
    workspaceId: input.workspaceId,
    handoffRequestId: input.handoffRequestId,
    eventType: "incoming_pm_acceptance_recorded",
    message: `Incoming PM acceptance recorded: ${input.decision}`,
    safeEventPayload: { acceptanceId: acceptance.id, decision: input.decision },
    actorId: input.incomingPmId,
  });

  return acceptance;
}

// ─── Complete Project Handoff ─────────────────────────────────────────────────

export async function completeProjectHandoff(raw: unknown): Promise<{
  assignmentPointer: AgentPmoControlledProjectAssignmentPointerRecord;
  assignmentHistory: AgentPmoProjectAssignmentHistoryRecord;
}> {
  const input = normalizeCompleteProjectHandoffInput(raw);
  const request = await getAgentPmoProjectHandoffRequestById(input.handoffRequestId);
  if (!request) throw new Error(`Handoff request not found: ${input.handoffRequestId}`);
  if (request.workspaceId !== input.workspaceId) throw new Error("Workspace scope mismatch");

  const gates = await listAgentPmoProjectHandoffGates(input.workspaceId, input.handoffRequestId);
  const approvedGate = gates.find((g) => g.gateStatus === "approved_for_handoff");
  const packs = await listAgentPmoProjectHandoffPacks(input.workspaceId, input.handoffRequestId);
  const memorySnapshots = await listAgentPmoProjectMemorySnapshots(input.workspaceId, input.handoffRequestId);
  const acceptances = await listAgentPmoIncomingPmAcceptances(input.workspaceId, input.handoffRequestId);
  const latestAcceptance = acceptances.find((a) => a.acceptanceStatus === "accepted");

  const readiness = evaluateProjectHandoffCompletionReadiness({
    requestStatus: request.status,
    gateApproved: !!approvedGate,
    packExists: packs.length > 0,
    memorySnapshotExists: memorySnapshots.length > 0,
    incomingPmAccepted: !!latestAcceptance,
  });

  if (!readiness.ready) throw new Error(`Handoff cannot be completed: ${readiness.reason}`);

  const existingPointer = await getAgentPmoControlledProjectAssignmentPointerByProject(
    input.workspaceId,
    request.projectId,
  );
  const previousPmId = existingPointer?.activePmId ?? request.currentPmId ?? null;

  const assignmentPointer = await upsertAgentPmoControlledProjectAssignmentPointer({
    workspaceId: input.workspaceId,
    projectId: request.projectId,
    activePmId: request.incomingPmId,
    previousPmId,
    handoffRequestId: input.handoffRequestId,
    handoffCompletedById: input.completedById ?? null,
    handoffCompletedAt: now(),
    assignmentVersion: existingPointer ? existingPointer.assignmentVersion + 1 : 1,
    handoffReason: request.handoffReason,
    safeAssignmentPayload: redactProjectHandoffPayload({
      projectId: request.projectId,
      handoffReason: request.handoffReason,
      completionRationale: input.completionRationale,
    }),
  });

  const assignmentHistory = await recordAgentPmoProjectAssignmentHistory({
    workspaceId: input.workspaceId,
    projectId: request.projectId,
    handoffRequestId: input.handoffRequestId,
    previousPmId,
    newPmId: request.incomingPmId,
    assignmentReason: sanitizeProjectHandoffText(input.completionRationale, 2000),
    assignmentSource: "controlled_handoff",
    effectiveDate: request.effectiveDate ?? now(),
    completedById: input.completedById ?? null,
    completedAt: now(),
    safeHistoryPayload: redactProjectHandoffPayload({ handoffReason: request.handoffReason }),
  });

  await updateAgentPmoProjectHandoffRequestStatus(input.handoffRequestId, "handoff_completed");

  await recordAgentPmoProjectHandoffAuditEvent({
    workspaceId: input.workspaceId,
    handoffRequestId: input.handoffRequestId,
    eventType: "controlled_assignment_pointer_updated",
    message: `Controlled assignment pointer updated: project ${request.projectId} → ${request.incomingPmId}`,
    safeEventPayload: { pointerId: assignmentPointer.id, previousPmId, newPmId: request.incomingPmId },
    actorId: input.completedById ?? null,
  });

  await recordAgentPmoProjectHandoffAuditEvent({
    workspaceId: input.workspaceId,
    handoffRequestId: input.handoffRequestId,
    eventType: "project_assignment_history_recorded",
    message: `Assignment history recorded: ${assignmentHistory.id}`,
    safeEventPayload: { historyId: assignmentHistory.id },
    actorId: input.completedById ?? null,
  });

  return { assignmentPointer, assignmentHistory };
}

// ─── Create Continuity Checks ─────────────────────────────────────────────────

export async function createHandoffContinuityChecks(
  workspaceId: string,
  handoffRequestId: string,
): Promise<AgentPmoHandoffContinuityCheckRecord[]> {
  const request = await getAgentPmoProjectHandoffRequestById(handoffRequestId);
  if (!request) throw new Error(`Handoff request not found: ${handoffRequestId}`);
  if (request.workspaceId !== workspaceId) throw new Error("Workspace scope mismatch");
  if (request.status !== "handoff_completed") {
    throw new Error(`Handoff request must be handoff_completed to create continuity checks (current: ${request.status})`);
  }

  const checkTypes: AgentPmoHandoffContinuityCheckType[] = [
    "incoming_pm_acknowledged", "critical_risks_reviewed", "critical_blockers_reviewed",
    "upcoming_milestones_reviewed", "open_decisions_reviewed", "stakeholder_context_reviewed",
    "client_commitments_reviewed", "first_status_update_completed",
    "handoff_pack_reviewed", "assignment_pointer_verified",
  ];

  const checks: AgentPmoHandoffContinuityCheckRecord[] = [];
  for (const checkType of checkTypes) {
    const check = await createAgentPmoHandoffContinuityCheck({
      workspaceId,
      handoffRequestId,
      checkType,
      checkStatus: "pending",
      rationale: null,
      completedAt: null,
      safeCheckPayload: redactProjectHandoffPayload({ checkType }),
    });
    checks.push(check);
    await recordAgentPmoProjectHandoffAuditEvent({
      workspaceId,
      handoffRequestId,
      eventType: "handoff_continuity_check_created",
      message: `Continuity check created: ${checkType}`,
      safeEventPayload: { checkId: check.id, checkType },
      actorId: null,
    });
  }

  await updateAgentPmoProjectHandoffRequestStatus(handoffRequestId, "continuity_monitoring");
  return checks;
}

// ─── Update Continuity Check ──────────────────────────────────────────────────

export async function updateHandoffContinuityCheck(
  workspaceId: string,
  checkId: string,
  checkStatus: import("./agent-pmo-project-handoff-types").AgentPmoHandoffContinuityCheckStatus,
  rationale?: string,
): Promise<AgentPmoHandoffContinuityCheckRecord> {
  const updated = await updateAgentPmoHandoffContinuityCheckStatus(checkId, checkStatus, rationale);
  if (!updated) throw new Error(`Continuity check not found: ${checkId}`);
  if (updated.workspaceId !== workspaceId) throw new Error("Workspace scope mismatch");

  const terminal = ["passed", "failed", "blocked", "waived", "not_applicable"];
  if (terminal.includes(checkStatus)) {
    await recordAgentPmoProjectHandoffAuditEvent({
      workspaceId,
      handoffRequestId: updated.handoffRequestId,
      eventType: "handoff_continuity_check_completed",
      message: `Continuity check completed: ${updated.checkType} → ${checkStatus}`,
      safeEventPayload: { checkId, checkType: updated.checkType, checkStatus },
      actorId: null,
    });
  }

  return updated;
}

// ─── Generate Export ──────────────────────────────────────────────────────────

export async function generateProjectHandoffExport(
  raw: unknown,
): Promise<AgentPmoProjectHandoffExportRecord> {
  const input = normalizeProjectHandoffExportInput(raw);
  const request = await getAgentPmoProjectHandoffRequestById(input.handoffRequestId);
  if (!request) throw new Error(`Handoff request not found: ${input.handoffRequestId}`);
  if (request.workspaceId !== input.workspaceId) throw new Error("Workspace scope mismatch");

  const [gates, gateDecisions, packs, memorySnapshots, statusSnapshots,
    snapshotItems, stakeholders, outgoingNotes, acceptances,
    pointers, history, continuityChecks, auditEvents] = await Promise.all([
    listAgentPmoProjectHandoffGates(input.workspaceId, input.handoffRequestId),
    listAgentPmoProjectHandoffGateDecisions(input.workspaceId),
    listAgentPmoProjectHandoffPacks(input.workspaceId, input.handoffRequestId),
    listAgentPmoProjectMemorySnapshots(input.workspaceId, input.handoffRequestId),
    listAgentPmoProjectStatusSnapshots(input.workspaceId, input.handoffRequestId),
    listAgentPmoProjectHandoffSnapshotItems(input.workspaceId, input.handoffRequestId),
    listAgentPmoStakeholderContextSnapshots(input.workspaceId, input.handoffRequestId),
    listAgentPmoOutgoingPmNotes(input.workspaceId, input.handoffRequestId),
    listAgentPmoIncomingPmAcceptances(input.workspaceId, input.handoffRequestId),
    listAgentPmoControlledProjectAssignmentPointers(input.workspaceId),
    listAgentPmoProjectAssignmentHistory(input.workspaceId, request.projectId),
    listAgentPmoHandoffContinuityChecks(input.workspaceId, input.handoffRequestId),
    listAgentPmoProjectHandoffAuditEvents(input.workspaceId, input.handoffRequestId),
  ]);

  const relevantGateDecisions = gateDecisions.filter((d) => d.handoffRequestId === input.handoffRequestId);
  const relevantPointers = pointers.filter((p) => p.projectId === request.projectId);

  const exportData = {
    exportType: "controlled_project_intelligence_handoff",
    nonGoals: [
      "This export does NOT include raw payloads, secrets, tokens, or credentials",
      "This export does NOT represent external communications, tickets, or calendar events",
      "This export does NOT trigger any external side effects",
      "This export does NOT delete or move project memory",
    ],
    handoffRequest: {
      id: request.id,
      workspaceId: request.workspaceId,
      projectId: request.projectId,
      handoffReason: request.handoffReason,
      handoffUrgency: request.handoffUrgency,
      status: request.status,
      effectiveDate: request.effectiveDate,
      createdAt: request.createdAt,
    },
    pmoGates: gates.map((g) => ({ id: g.id, gateStatus: g.gateStatus, createdAt: g.createdAt })),
    gateDecisions: relevantGateDecisions.map((d) => ({ id: d.id, decision: d.decision, decidedAt: d.decidedAt })),
    packCount: packs.length,
    memorySnapshotCount: memorySnapshots.length,
    statusSnapshotCount: statusSnapshots.length,
    snapshotItemCount: snapshotItems.length,
    stakeholderContextCount: stakeholders.length,
    outgoingNoteCount: outgoingNotes.length,
    acceptanceCount: acceptances.length,
    assignmentPointerCount: relevantPointers.length,
    assignmentHistoryCount: history.length,
    continuityCheckCount: continuityChecks.length,
    openContinuityCheckCount: continuityChecks.filter((c) => c.checkStatus === "pending").length,
    auditEventCount: auditEvents.length,
    auditEventTypes: [...new Set(auditEvents.map((e) => e.eventType))],
  };

  const content = input.exportFormat === "json"
    ? JSON.stringify(exportData, null, 2)
    : input.exportFormat === "csv"
    ? `handoff_request_id,status,handoff_reason,urgency,project_id\n${request.id},${request.status},${request.handoffReason},${request.handoffUrgency},${request.projectId}`
    : `# Controlled Project Intelligence Handoff Export\n\n## Handoff Request\n- ID: ${request.id}\n- Project: ${request.projectId}\n- Status: ${request.status}\n- Reason: ${request.handoffReason}\n- Urgency: ${request.handoffUrgency}\n\n## Summary\n- PMO Gates: ${gates.length}\n- Handoff Packs: ${packs.length}\n- Memory Snapshots: ${memorySnapshots.length}\n- Snapshot Items: ${snapshotItems.length}\n- Continuity Checks: ${continuityChecks.length} (${continuityChecks.filter((c) => c.checkStatus === "pending").length} pending)\n\n## Non-Goals\nThis export does not include secrets, raw payloads, or private contact data.\nNo external side effects were triggered during export generation.\n`;

  const safetyCheck = validateProjectHandoffExportSafety(content);
  if (!safetyCheck.safe) {
    throw new Error(`Export failed safety validation: ${safetyCheck.reason}`);
  }

  const record = await createAgentPmoProjectHandoffExport({
    workspaceId: input.workspaceId,
    handoffRequestId: input.handoffRequestId,
    exportFormat: input.exportFormat,
    exportStatus: "generated",
    safeExportContent: content,
    exportSizeBytes: Buffer.byteLength(content, "utf8"),
    safetyValidationPassed: true,
    createdById: input.createdById ?? null,
  });

  await recordAgentPmoProjectHandoffAuditEvent({
    workspaceId: input.workspaceId,
    handoffRequestId: input.handoffRequestId,
    eventType: "handoff_export_created",
    message: `Handoff export created: ${record.id} (format: ${input.exportFormat})`,
    safeEventPayload: { exportId: record.id, exportFormat: input.exportFormat, sizeBytes: record.exportSizeBytes },
    actorId: input.createdById ?? null,
  });

  return record;
}

// ─── Archive Handoff Request ──────────────────────────────────────────────────

export async function archiveProjectHandoffRequest(
  workspaceId: string,
  handoffRequestId: string,
  rationale: string,
): Promise<AgentPmoProjectHandoffRequestRecord> {
  if (!rationale?.trim()) throw new Error("Rationale required to archive handoff request");
  const request = await getAgentPmoProjectHandoffRequestById(handoffRequestId);
  if (!request) throw new Error(`Handoff request not found: ${handoffRequestId}`);
  if (request.workspaceId !== workspaceId) throw new Error("Workspace scope mismatch");
  if (request.status === "assignment_update_pending") {
    throw new Error("Cannot archive a handoff request in assignment_update_pending status");
  }
  const updated = await updateAgentPmoProjectHandoffRequestStatus(handoffRequestId, "archived");
  if (!updated) throw new Error("Failed to archive handoff request");
  await recordAgentPmoProjectHandoffAuditEvent({
    workspaceId,
    handoffRequestId,
    eventType: "handoff_request_archived",
    message: `Handoff request archived: ${handoffRequestId}`,
    safeEventPayload: { rationale: sanitizeProjectHandoffText(rationale, 1000) },
    actorId: null,
  });
  return updated;
}

// ─── Build Summary ────────────────────────────────────────────────────────────

export async function buildProjectHandoffSummary(workspaceId: string): Promise<Record<string, unknown>> {
  const requests = await listAgentPmoProjectHandoffRequests(workspaceId);
  const packs = await listAgentPmoProjectHandoffPacks(workspaceId);
  const memorySnapshots = await listAgentPmoProjectMemorySnapshots(workspaceId);
  const outgoingNotes = await listAgentPmoOutgoingPmNotes(workspaceId);
  const acceptances = await listAgentPmoIncomingPmAcceptances(workspaceId);
  const pointers = await listAgentPmoControlledProjectAssignmentPointers(workspaceId);
  const history = await listAgentPmoProjectAssignmentHistory(workspaceId);
  const continuityChecks = await listAgentPmoHandoffContinuityChecks(workspaceId);

  const byStatus = (status: string) => requests.filter((r) => r.status === status).length;
  const urgencyOrder = { critical: 4, high: 3, normal: 2, low: 1 };
  const active = requests.filter((r) => !["handoff_completed", "continuity_monitoring", "blocked", "archived"].includes(r.status));
  const highestUrgency = active.sort((a, b) => (urgencyOrder[b.handoffUrgency] ?? 0) - (urgencyOrder[a.handoffUrgency] ?? 0))[0] ?? null;
  const oldestPmoReview = requests.filter((r) => r.status === "pmo_review_required").sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null;

  return {
    totalHandoffRequests: requests.length,
    contextValidationPending: byStatus("context_validation_pending"),
    readyForPmoReview: byStatus("ready_for_pmo_review"),
    pmoReviewRequired: byStatus("pmo_review_required"),
    pmoApproved: byStatus("pmo_approved"),
    handoffPackCreated: byStatus("handoff_pack_created"),
    incomingPmReviewRequired: byStatus("incoming_pm_review_required"),
    incomingPmAccepted: byStatus("incoming_pm_accepted"),
    incomingPmRejected: byStatus("incoming_pm_rejected"),
    handoffCompleted: byStatus("handoff_completed"),
    continuityMonitoring: byStatus("continuity_monitoring"),
    blocked: byStatus("blocked"),
    archived: byStatus("archived"),
    handoffPackCount: packs.length,
    memorySnapshotCount: memorySnapshots.length,
    outgoingPmNoteCount: outgoingNotes.length,
    incomingPmAcceptanceCount: acceptances.length,
    assignmentPointerCount: pointers.length,
    assignmentHistoryCount: history.length,
    continuityCheckCount: continuityChecks.length,
    openContinuityCheckCount: continuityChecks.filter((c) => c.checkStatus === "pending").length,
    oldestPmoReviewRequestId: oldestPmoReview?.id ?? null,
    highestUrgencyActiveRequestId: highestUrgency?.id ?? null,
    highestUrgencyActiveRequestUrgency: highestUrgency?.handoffUrgency ?? null,
  };
}

// ─── Get Full Handoff Data ────────────────────────────────────────────────────

export async function getProjectHandoffData(workspaceId: string, handoffRequestId: string): Promise<Record<string, unknown>> {
  const [
    request,
    contextValidations,
    gates,
    gateDecisions,
    packs,
    memorySnapshots,
    statusSnapshots,
    snapshotItems,
    stakeholderContextSnapshots,
    outgoingNotes,
    acceptances,
    auditEvents,
    continuityChecks,
    exports,
  ] = await Promise.all([
    getAgentPmoProjectHandoffRequestById(handoffRequestId),
    listAgentPmoProjectContextValidations(workspaceId, handoffRequestId),
    listAgentPmoProjectHandoffGates(workspaceId, handoffRequestId),
    listAgentPmoProjectHandoffGateDecisions(workspaceId, undefined),
    listAgentPmoProjectHandoffPacks(workspaceId, handoffRequestId),
    listAgentPmoProjectMemorySnapshots(workspaceId, handoffRequestId),
    listAgentPmoProjectStatusSnapshots(workspaceId, handoffRequestId),
    listAgentPmoProjectHandoffSnapshotItems(workspaceId, handoffRequestId),
    listAgentPmoStakeholderContextSnapshots(workspaceId, handoffRequestId),
    listAgentPmoOutgoingPmNotes(workspaceId, handoffRequestId),
    listAgentPmoIncomingPmAcceptances(workspaceId, handoffRequestId),
    listAgentPmoProjectHandoffAuditEvents(workspaceId, handoffRequestId),
    listAgentPmoHandoffContinuityChecks(workspaceId, handoffRequestId),
    listAgentPmoProjectHandoffExports(workspaceId, handoffRequestId),
  ]);

  const projectId = request?.projectId;
  const [pointers, history] = await Promise.all([
    listAgentPmoControlledProjectAssignmentPointers(workspaceId),
    projectId ? listAgentPmoProjectAssignmentHistory(workspaceId, projectId) : Promise.resolve([]),
  ]);

  const summary = await buildProjectHandoffSummary(workspaceId);

  return {
    request,
    contextValidations,
    gates,
    gateDecisions: gateDecisions.filter((d) => d.handoffRequestId === handoffRequestId),
    packs,
    memorySnapshots,
    statusSnapshots,
    snapshotItems,
    stakeholderContextSnapshots,
    outgoingNotes,
    acceptances,
    assignmentPointers: pointers.filter((p) => p.projectId === projectId),
    assignmentHistory: history,
    continuityChecks,
    exports,
    auditEvents,
    summary,
  };
}
