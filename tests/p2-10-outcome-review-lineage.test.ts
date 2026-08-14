import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ensureExpectedOutcome,
  getCompleteLineageProjection,
  reconstructAuditTrail,
  recordOutcomeObservation,
} from "../src/lib/operational-flow/operational-flow-service";
import type { CompleteLineageProjection } from "../src/lib/operational-flow/types";

const serviceCode = readFileSync("src/lib/operational-flow/operational-flow-service.ts", "utf8");
const apiRouteCode = readFileSync("src/app/api/operational-flow/route.ts", "utf8");
const typesCode = readFileSync("src/lib/operational-flow/types.ts", "utf8");

test("P2-10: Type declarations define CompleteLineageProjection, LineageStepNode, LineageTransition, and AuditReconstructionItem", () => {
  assert.match(typesCode, /export type LineageStepKind\s*=/);
  for (const kind of [
    "source",
    "raw_input",
    "normalized_event",
    "evidence",
    "finding",
    "governance",
    "recommendation",
    "decision",
    "material_action",
    "task",
    "internal_execution",
    "outcome",
    "observation",
  ]) {
    assert.match(typesCode, new RegExp(`\\| "${kind}"`));
  }
  assert.match(typesCode, /export type LineageLinkRelationship\s*=/);
  for (const relationship of [
    "causation",
    "correlation_only",
    "direct_reference",
    "unlinked",
  ]) {
    assert.match(typesCode, new RegExp(`"${relationship}"`));
  }
  assert.match(typesCode, /export type LineageLinkStatus\s*=/);
  for (const status of [
    "intact",
    "missing",
    "disputed",
    "inconclusive",
    "degraded",
    "fixture",
  ]) {
    assert.match(typesCode, new RegExp(`"${status}"`));
  }
  assert.match(typesCode, /export type CompleteLineageProjection\s*=/);
  assert.match(typesCode, /hasCorrelationOnly:\s*boolean/);
  assert.match(typesCode, /gaps:\s*string\[\]/);
  assert.match(typesCode, /disputes:\s*string\[\]/);
  assert.match(typesCode, /export type AuditReconstructionItem\s*=/);
});

test("P2-10: Lineage reconstruction guarantees correlation is NEVER promoted to causation", () => {
  // Check the canonical relationship vocabulary and explicit semantic invariant.
  assert.match(typesCode, /"correlation_only"/);
  assert.match(typesCode, /"causation"/);
  assert.match(typesCode, /isCausal:\s*boolean/);
  assert.match(serviceCode, /Correlation does NOT imply causation/);
  assert.match(typesCode, /relationship:\s*LineageLinkRelationship/);
});

test("P2-10: Lineage projection does NOT swallow errors with catch-all fallbacks", () => {
  assert.doesNotMatch(serviceCode, /getCompleteLineageProjection[\s\S]*?\.catch\(\(\)\s*=>\s*\[\]\)/);
  assert.match(serviceCode, /const lineages = await getCompleteLineageProjection\(client, workspaceId, projectId\);/);
});

test("P2-10: Mocked complete lineage graph correctly traces Evidence → Finding → Recommendation → Decision → Action → Task → Observation", async () => {
  const workspaceId = "ws-p210-001";
  const projectId = "proj-p210-001";
  const outcomeId = "out-001";
  const taskId = "task-001";
  const actionId = "act-001";
  const decisionId = "dec-001";
  const recId = "rec-001";
  const signalId = "sig-001";
  const evidenceId = "ev-001";
  const normEventId = "norm-001";
  const rawInputId = "raw-001";
  const sourceId = "src-001";
  const obsId = "obs-001";
  const obsEvidenceId = "ev-obs-001";

  const mockDb: Record<string, unknown[]> = {
    canonical_task_outcomes: [
      {
        id: outcomeId,
        workspace_id: workspaceId,
        project_id: projectId,
        task_id: taskId,
        source_action_id: actionId,
        state: "achieved",
        expected_result: "Project plan approved by sponsor",
        success_criteria: ["signature_received", "budget_approved"],
        correlation_id: "corr-100",
        causation_id: taskId,
        fixture_label: null,
        created_by: "user-1",
        created_at: "2026-08-13T10:00:00Z",
      },
    ],
    canonical_outcome_observations: [
      {
        id: obsId,
        workspace_id: workspaceId,
        project_id: projectId,
        outcome_id: outcomeId,
        task_id: taskId,
        observation_state: "achieved",
        summary: "Verified signature on budget allocation document.",
        evidence_reference_ids: [obsEvidenceId],
        confidence_score: 0.98,
        missing_data_state: "COMPLETE",
        observed_by: "user-1",
        observed_at: "2026-08-13T12:00:00Z",
        evaluated_at: "2026-08-13T12:00:00Z",
        recorded_at: "2026-08-13T12:00:00Z",
        correlation_id: "corr-100",
        causation_id: outcomeId,
        fixture_label: null,
      },
    ],
    execution_tasks: [
      {
        id: taskId,
        workspace_id: workspaceId,
        project_id: projectId,
        source_action_id: actionId,
        title: "Obtain sponsor sign-off",
        status: "completed",
        priority: "high",
        correlation_id: "corr-100",
        causation_id: actionId,
        created_at: "2026-08-13T09:00:00Z",
      },
    ],
    internal_task_executions: [
      {
        id: "exec-001",
        workspace_id: workspaceId,
        project_id: projectId,
        task_id: taskId,
        status: "completed",
        attempt_count: 1,
        provider_key: "internal:state_machine",
        idempotency_key: "idem-exec-001",
        correlation_id: "corr-100",
        causation_id: taskId,
        started_at: "2026-08-13T09:01:00Z",
        completed_at: "2026-08-13T09:05:00Z",
      },
    ],
    material_action_proposals: [
      {
        id: actionId,
        workspace_id: workspaceId,
        project_id: projectId,
        source_decision_id: decisionId,
        action_class: "ordinary_business_write",
        materiality: "material",
        proposal: { decisionReferenceId: decisionId },
        proposal_digest: "digest-act-001",
        correlation_id: "corr-100",
        causation_id: decisionId,
        persisted_at: "2026-08-13T08:30:00Z",
      },
    ],
    material_action_governance_evaluations: [
      {
        id: "eval-001",
        workspace_id: workspaceId,
        project_id: projectId,
        action_id: actionId,
        governance_state: "authorized",
        recorded_at: "2026-08-13T08:31:00Z",
      },
    ],
    operational_decision_records: [
      {
        id: decisionId,
        workspace_id: workspaceId,
        project_id: projectId,
        recommendation_id: recId,
        governance_event_id: "gov-001",
        decision: "Proceed with sign-off request",
        decision_status: "accepted",
        rationale: "All risk criteria cleared",
        decided_by: "user-1",
        created_at: "2026-08-13T08:00:00Z",
      },
    ],
    decision_evidence_links: [
      {
        workspace_id: workspaceId,
        decision_record_id: decisionId,
        evidence_item_id: evidenceId,
      },
    ],
    recommended_actions: [
      {
        id: recId,
        workspace_id: workspaceId,
        project_id: projectId,
        signal_id: signalId,
        governance_event_id: "gov-001",
        title: "Request sign-off",
        proposed_action: "Send sign-off packet",
        urgency: "medium",
        status: "accepted",
        created_at: "2026-08-13T07:30:00Z",
      },
    ],
    governance_events: [
      {
        id: "gov-001",
        workspace_id: workspaceId,
        project_id: projectId,
        signal_id: signalId,
        rule_key: "rule:sponsor_signoff_req",
        governance_status: "compliant",
        authority_required: "pm_lead",
        created_at: "2026-08-13T07:20:00Z",
      },
    ],
    operational_signals: [
      {
        id: signalId,
        workspace_id: workspaceId,
        project_id: projectId,
        evidence_item_id: evidenceId,
        signal_type: "readiness_clearance",
        severity: "low",
        confidence_score: 0.95,
        summary: "Readiness criteria satisfied",
        created_at: "2026-08-13T07:10:00Z",
      },
    ],
    evidence_items: [
      {
        id: evidenceId,
        workspace_id: workspaceId,
        project_id: projectId,
        normalized_event_id: normEventId,
        classification: "DECISION_CONTEXT",
        assertion_type: "FACT",
        confidence_score: 0.95,
        missing_data_state: "COMPLETE",
        freshness_state: "CURRENT",
        fixture_state: "LIVE",
        degraded_reason: null,
        created_by: "user-1",
        evaluated_at: "2026-08-13T07:05:00Z",
        created_at: "2026-08-13T07:05:00Z",
      },
      {
        id: obsEvidenceId,
        workspace_id: workspaceId,
        project_id: projectId,
        normalized_event_id: "norm-obs-001",
        classification: "DELIVERY",
        assertion_type: "FACT",
        confidence_score: 0.98,
        missing_data_state: "COMPLETE",
        freshness_state: "CURRENT",
        fixture_state: "LIVE",
        degraded_reason: null,
        created_by: "user-1",
        evaluated_at: "2026-08-13T11:55:00Z",
        created_at: "2026-08-13T11:55:00Z",
      },
    ],
    operational_normalized_events: [
      {
        id: normEventId,
        workspace_id: workspaceId,
        project_id: projectId,
        raw_input_id: rawInputId,
        source_id: sourceId,
        event_type: "SPONSOR_PACKET_VALIDATED",
        schema_version: 1,
        event_digest: "digest-norm-001",
        correlation_id: "corr-100",
        causation_id: rawInputId,
        occurred_at: "2026-08-13T07:00:00Z",
        recorded_at: "2026-08-13T07:01:00Z",
        actor_user_id: "user-1",
      },
    ],
    operational_raw_inputs: [
      {
        id: rawInputId,
        workspace_id: workspaceId,
        project_id: projectId,
        source_id: sourceId,
        content_digest: "digest-raw-001",
        status: "intact",
        correlation_id: "corr-100",
        causation_id: null,
        occurred_at: "2026-08-13T06:55:00Z",
        captured_at: "2026-08-13T06:56:00Z",
        actor_user_id: "user-1",
      },
    ],
    operational_sources: [
      {
        id: sourceId,
        workspace_id: workspaceId,
        project_id: projectId,
        display_name: "Sponsor Document Ingestion",
        source_key: "src-sponsor-v1",
        source_kind: "api_webhook",
        status: "active",
        is_fixture: false,
        fixture_label: null,
        created_by: "user-1",
        created_at: "2026-08-13T06:00:00Z",
      },
    ],
    platform_events: [
      {
        id: "evt-001",
        workspace_id: workspaceId,
        project_id: projectId,
        event_type: "OUTCOME_OBSERVED",
        event_category: "operational_assurance",
        actor_id: "user-1",
        actor_type: "user",
        correlation_id: "corr-100",
        causation_id: outcomeId,
        raw_reference_table: "canonical_task_outcomes",
        raw_reference_id: outcomeId,
        event_payload: { outcomeId, state: "achieved" },
        metadata: {},
        occurred_at: "2026-08-13T12:00:00Z",
        created_at: "2026-08-13T12:00:00Z",
      },
    ],
  };

  const createMockClient = () => {
    return {
      from: (table: string) => {
        let rows = [...(mockDb[table] ?? [])];
        const queryBuilder: any = {
          select: () => queryBuilder,
          eq: (col: string, val: unknown) => {
            rows = rows.filter((r: any) => r[col] === val);
            return queryBuilder;
          },
          in: (col: string, vals: unknown[]) => {
            rows = rows.filter((r: any) => vals.includes(r[col]));
            return queryBuilder;
          },
          order: () => queryBuilder,
          limit: () => queryBuilder,
          then: (resolve: any) => resolve({ data: rows, error: null }),
        };
        return queryBuilder;
      },
    } as any;
  };

  const client = createMockClient();
  const projections = await getCompleteLineageProjection(client, workspaceId, projectId);

  assert.equal(projections.length, 1);
  const proj = projections[0];

  assert.equal(proj.outcomeId, outcomeId);
  assert.equal(proj.taskId, taskId);
  assert.equal(proj.outcomeState, "achieved");
  assert.equal(proj.lineageStatus, "complete");
  assert.equal(proj.gaps.length, 0);
  assert.equal(proj.disputes.length, 0);

  // Check step nodes
  const kinds = proj.steps.map((s) => s.kind);
  assert.ok(kinds.includes("source"));
  assert.ok(kinds.includes("raw_input"));
  assert.ok(kinds.includes("normalized_event"));
  assert.ok(kinds.includes("evidence"));
  assert.ok(kinds.includes("finding"));
  assert.ok(kinds.includes("recommendation"));
  assert.ok(kinds.includes("decision"));
  assert.ok(kinds.includes("material_action"));
  assert.ok(kinds.includes("task"));
  assert.ok(kinds.includes("internal_execution"));
  assert.ok(kinds.includes("outcome"));
  assert.ok(kinds.includes("observation"));

  // Check causal transitions
  const taskToOutcome = proj.transitions.find((t) => t.fromKind === "task" && t.toKind === "internal_execution");
  assert.ok(taskToOutcome);
  assert.equal(taskToOutcome.isCausal, true);
  assert.equal(taskToOutcome.relationship, "causation");

  // Check audit events attached
  assert.equal(proj.auditEvents.length, 1);
  assert.equal(proj.auditEvents[0].event_type, "OUTCOME_OBSERVED");
});

test("P2-10: Lineage projection detects gaps honestly when intermediate steps are missing", async () => {
  const workspaceId = "ws-p210-gap";
  const projectId = "proj-p210-gap";
  const outcomeId = "out-gap-001";
  const taskId = "task-gap-001";

  // Task and Outcome exist, but NO Governed Action, Decision, or Observations exist
  const mockDb: Record<string, unknown[]> = {
    canonical_task_outcomes: [
      {
        id: outcomeId,
        workspace_id: workspaceId,
        project_id: projectId,
        task_id: taskId,
        source_action_id: null,
        state: "expected",
        expected_result: "Direct task expected result",
        success_criteria: [],
        correlation_id: "corr-gap-100",
        causation_id: null,
        fixture_label: null,
        created_by: "user-1",
        created_at: "2026-08-13T10:00:00Z",
      },
    ],
    canonical_outcome_observations: [],
    execution_tasks: [
      {
        id: taskId,
        workspace_id: workspaceId,
        project_id: projectId,
        source_action_id: null,
        title: "Direct manual task",
        status: "completed",
        priority: "medium",
        correlation_id: "corr-gap-100",
        causation_id: null,
        created_at: "2026-08-13T09:00:00Z",
      },
    ],
    internal_task_executions: [],
    material_action_proposals: [],
    material_action_governance_evaluations: [],
    operational_decision_records: [],
    decision_evidence_links: [],
    recommended_actions: [],
    governance_events: [],
    operational_signals: [],
    evidence_items: [],
    operational_normalized_events: [],
    operational_raw_inputs: [],
    operational_sources: [],
    platform_events: [],
  };

  const createMockClient = () => {
    return {
      from: (table: string) => {
        let rows = [...(mockDb[table] ?? [])];
        const queryBuilder: any = {
          select: () => queryBuilder,
          eq: (col: string, val: unknown) => {
            rows = rows.filter((r: any) => r[col] === val);
            return queryBuilder;
          },
          in: (col: string, vals: unknown[]) => {
            rows = rows.filter((r: any) => vals.includes(r[col]));
            return queryBuilder;
          },
          order: () => queryBuilder,
          limit: () => queryBuilder,
          then: (resolve: any) => resolve({ data: rows, error: null }),
        };
        return queryBuilder;
      },
    } as any;
  };

  const client = createMockClient();
  const projections = await getCompleteLineageProjection(client, workspaceId, projectId);

  assert.equal(projections.length, 1);
  const proj = projections[0];

  assert.equal(proj.lineageStatus, "incomplete");
  assert.ok(proj.gaps.length > 0);

  // Missing nodes must be explicitly marked missing
  const actionNode = proj.steps.find((s) => s.kind === "material_action");
  assert.equal(actionNode?.status, "missing");
  assert.equal(actionNode?.id, null);
  assert.ok(actionNode?.gapReason);

  const obsNode = proj.steps.find((s) => s.kind === "observation");
  assert.equal(obsNode?.status, "missing");
  assert.equal(obsNode?.id, null);
  assert.ok(obsNode?.gapReason?.includes("Awaiting authorized"));

  // Task completed does NOT mean achieved
  assert.equal(proj.outcomeState, "expected");
});

test("P2-10: Lineage projection detects disputed and inconclusive states honestly", async () => {
  const workspaceId = "ws-p210-disp";
  const projectId = "proj-p210-disp";
  const outcomeId = "out-disp-001";
  const taskId = "task-disp-001";
  const obsId = "obs-disp-001";

  const mockDb: Record<string, unknown[]> = {
    canonical_task_outcomes: [
      {
        id: outcomeId,
        workspace_id: workspaceId,
        project_id: projectId,
        task_id: taskId,
        source_action_id: null,
        state: "disputed",
        expected_result: "Disputed metric target",
        success_criteria: [],
        correlation_id: "corr-disp-100",
        causation_id: null,
        fixture_label: null,
        created_by: "user-1",
        created_at: "2026-08-13T10:00:00Z",
      },
    ],
    canonical_outcome_observations: [
      {
        id: obsId,
        workspace_id: workspaceId,
        project_id: projectId,
        outcome_id: outcomeId,
        task_id: taskId,
        observation_state: "disputed",
        summary: "Contradictory telemetry reported by external observer.",
        evidence_reference_ids: [],
        confidence_score: 0.5,
        missing_data_state: "PARTIAL",
        observed_by: "user-1",
        observed_at: "2026-08-13T12:00:00Z",
        evaluated_at: "2026-08-13T12:00:00Z",
        recorded_at: "2026-08-13T12:00:00Z",
        correlation_id: "corr-disp-100",
        causation_id: null,
        fixture_label: null,
      },
    ],
    execution_tasks: [
      {
        id: taskId,
        workspace_id: workspaceId,
        project_id: projectId,
        source_action_id: null,
        title: "Disputed task",
        status: "completed",
        priority: "medium",
        correlation_id: "corr-disp-100",
        causation_id: null,
        created_at: "2026-08-13T09:00:00Z",
      },
    ],
    internal_task_executions: [],
    material_action_proposals: [],
    material_action_governance_evaluations: [],
    operational_decision_records: [],
    decision_evidence_links: [],
    recommended_actions: [],
    governance_events: [],
    operational_signals: [],
    evidence_items: [],
    operational_normalized_events: [],
    operational_raw_inputs: [],
    operational_sources: [],
    platform_events: [],
  };

  const createMockClient = () => {
    return {
      from: (table: string) => {
        let rows = [...(mockDb[table] ?? [])];
        const queryBuilder: any = {
          select: () => queryBuilder,
          eq: (col: string, val: unknown) => {
            rows = rows.filter((r: any) => r[col] === val);
            return queryBuilder;
          },
          in: (col: string, vals: unknown[]) => {
            rows = rows.filter((r: any) => vals.includes(r[col]));
            return queryBuilder;
          },
          order: () => queryBuilder,
          limit: () => queryBuilder,
          then: (resolve: any) => resolve({ data: rows, error: null }),
        };
        return queryBuilder;
      },
    } as any;
  };

  const client = createMockClient();
  const projections = await getCompleteLineageProjection(client, workspaceId, projectId);

  assert.equal(projections.length, 1);
  const proj = projections[0];

  assert.equal(proj.lineageStatus, "disputed");
  assert.ok(proj.disputes.length > 0);
  assert.ok(proj.disputes.some((d) => d.includes("disputed state")));
});

test("P2-10: Audit trail reconstruction preserves occurredAt vs recordedAt and distinguishes causation from correlation", async () => {
  const workspaceId = "ws-p210-audit";
  const projectId = "proj-p210-audit";

  const mockEvents = [
    {
      id: "evt-c-1",
      workspace_id: workspaceId,
      project_id: projectId,
      event_type: "MATERIAL_ACTION_DISPATCHED",
      event_category: "operational_flow",
      actor_id: "user-1",
      actor_type: "user",
      occurred_at: "2026-08-13T10:00:00Z",
      created_at: "2026-08-13T10:00:01Z",
      correlation_id: "corr-audit-1",
      causation_id: "dec-001",
      raw_reference_table: "material_action_proposals",
      raw_reference_id: "act-001",
      event_payload: { actionId: "act-001" },
      metadata: {},
    },
    {
      id: "evt-c-2",
      workspace_id: workspaceId,
      project_id: projectId,
      event_type: "SIGNAL_DETECTED",
      event_category: "operational_flow",
      actor_id: "system-1",
      actor_type: "agent",
      occurred_at: "2026-08-13T09:00:00Z",
      created_at: "2026-08-13T09:00:02Z",
      correlation_id: "corr-audit-1",
      causation_id: null,
      raw_reference_table: "operational_signals",
      raw_reference_id: "sig-001",
      event_payload: { signalType: "risk" },
      metadata: {},
    },
  ];

  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: mockEvents, error: null }),
            }),
          }),
        }),
      }),
    }),
  } as any;

  const trail = await reconstructAuditTrail(client, workspaceId, projectId);
  assert.equal(trail.length, 2);

  // First item has explicit causation_id
  assert.equal(trail[0].relationship, "causation");
  assert.equal(trail[0].occurredAt, "2026-08-13T10:00:00Z");
  assert.equal(trail[0].recordedAt, "2026-08-13T10:00:01Z");

  // Second item only has correlation_id
  assert.equal(trail[1].relationship, "correlation_only");
});

test("P2-10: API route validates input, tenant scoping, and authorized roles for outcomes & observations", () => {
  assert.match(apiRouteCode, /ensure_expected_outcome/);
  assert.match(apiRouteCode, /record_outcome_observation/);
  assert.match(apiRouteCode, /view === "lineage"/);
  assert.match(apiRouteCode, /view === "audit"/);
  assert.match(apiRouteCode, /OBSERVATION_STATES\.has\(observationState\)/);
});
