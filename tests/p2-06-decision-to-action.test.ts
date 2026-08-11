import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { proposeGovernedMaterialAction } from "../src/lib/operational-flow/operational-flow-service";

const DECISION = "11111111-1111-4111-8111-111111111111";
const WORKSPACE = "22222222-2222-4222-8222-222222222222";
const PROJECT = "33333333-3333-4333-8333-333333333333";
const USER = "44444444-4444-4444-8444-444444444444";

function client(options: { role?: string; decisionStatus?: string; evidence?: boolean; governance?: boolean } = {}) {
  let persisted: Record<string, unknown> | null = null;
  const query = (table: string) => {
    void table;
    const chain: Record<string, unknown> = {};
    for (const name of ["select", "eq"]) chain[name] = () => chain;
    chain.maybeSingle = async () => ({ data: {
      id: DECISION, workspace_id: WORKSPACE, project_id: PROJECT, decided_by: USER,
      decision_status: options.decisionStatus ?? "accepted", recommendation_id: "recommendation-1",
      governance_event_id: options.governance === false ? null : "55555555-5555-4555-8555-555555555555", created_at: "2026-08-11T10:00:00Z",
    }, error: null });
    chain.then = (resolve: (value: unknown) => unknown) => resolve({ data: options.evidence === false ? [] : [{ evidence_item_id: "66666666-6666-4666-8666-666666666666", evidence_hash_at_decision: "a".repeat(64), evidence_version_at_decision: 1 }], error: null });
    return chain;
  };
  return {
    from: query,
    rpc: async (_name: string, args: Record<string, unknown>) => {
      persisted = args;
      const evaluation = args.p_evaluation as Record<string, unknown>;
      return { data: { disposition: "created", evaluation, nonExecution: { taskCreated: false, dispatched: false, executed: false, outcomeCreated: false, observationCreated: false, learningElevated: false, remoteAocWriteback: false } }, error: null };
    },
    persisted: () => persisted,
  };
}

const input = () => ({
  decisionId: DECISION, idempotencyKey: "decision-1:action:v1", actionClass: "external_write" as const,
  actionType: "update_schedule", targetResourceType: "schedule", targetResourceId: "milestone-1", intendedOperation: "propose_update",
  intendedEffect: "Move milestone by two days", risk: "high" as const, reversibility: "partially_reversible" as const,
  sideEffect: "external" as const, justification: "Evidence-backed recovery option", createdAt: "2026-08-11T12:00:00Z",
  evaluationTime: "2026-08-11T12:01:00Z", expiresAt: "2026-08-12T12:00:00Z",
});

test("eligible Decision and Evidence produce authorized but inert canonical Material Action", async () => {
  const fake = client();
  const result = await proposeGovernedMaterialAction(fake as never, { workspaceId: WORKSPACE, projectId: PROJECT, userId: USER, role: "owner" }, input());
  const call = fake.persisted() as { p_proposal: Record<string, unknown>; p_evaluation: Record<string, unknown> };
  assert.equal(call.p_proposal.schemaVersion, "pmfreak.material-action.v1");
  assert.match(String(call.p_proposal.deterministicDigest), /^[a-f0-9]{64}$/);
  assert.equal(call.p_evaluation.contractVersion, "pmfreak.aoc-e.in-process-governance.v1");
  assert.equal(call.p_evaluation.evaluatedAt, "2026-08-11T12:01:00.000Z");
  assert.equal(call.p_evaluation.state, "authorized");
  assert.deepEqual((result.nonExecution as Record<string, boolean>), { taskCreated: false, dispatched: false, executed: false, outcomeCreated: false, observationCreated: false, learningElevated: false, remoteAocWriteback: false });
  assert.match(String(result.authorizationMessage), /does not mean Executed/);
});

test("same canonical input has stable action identity and digest", async () => {
  const first = client(); const second = client();
  await proposeGovernedMaterialAction(first as never, { workspaceId: WORKSPACE, projectId: PROJECT, userId: USER, role: "owner" }, input());
  await proposeGovernedMaterialAction(second as never, { workspaceId: WORKSPACE, projectId: PROJECT, userId: USER, role: "owner" }, input());
  assert.deepEqual((first.persisted() as Record<string, unknown>).p_proposal, (second.persisted() as Record<string, unknown>).p_proposal);
});

test("viewer, ineligible Decision, wrong actor, and missing Evidence fail closed", async () => {
  await assert.rejects(() => proposeGovernedMaterialAction(client() as never, { workspaceId: WORKSPACE, projectId: PROJECT, userId: USER, role: "viewer" }, input()), /write_denied/);
  await assert.rejects(() => proposeGovernedMaterialAction(client({ decisionStatus: "rejected" }) as never, { workspaceId: WORKSPACE, projectId: PROJECT, userId: USER, role: "owner" }, input()), /ineligible/);
  await assert.rejects(() => proposeGovernedMaterialAction(client() as never, { workspaceId: WORKSPACE, projectId: PROJECT, userId: "77777777-7777-4777-8777-777777777777", role: "owner" }, input()), /actor_mismatch/);
  await assert.rejects(() => proposeGovernedMaterialAction(client({ evidence: false }) as never, { workspaceId: WORKSPACE, projectId: PROJECT, userId: USER, role: "owner" }, input()), /evidence_required/);
});

test("missing in-process policy and unknown materiality are unavailable/degraded, never authorized", async () => {
  const unavailable = client({ governance: false });
  await proposeGovernedMaterialAction(unavailable as never, { workspaceId: WORKSPACE, projectId: PROJECT, userId: USER, role: "owner" }, input());
  assert.equal((((unavailable.persisted() as Record<string, unknown>).p_evaluation) as Record<string, unknown>).state, "unavailable");
  const degraded = client();
  await proposeGovernedMaterialAction(degraded as never, { workspaceId: WORKSPACE, projectId: PROJECT, userId: USER, role: "owner" }, { ...input(), risk: "unknown" });
  assert.equal((((degraded.persisted() as Record<string, unknown>).p_evaluation) as Record<string, unknown>).state, "degraded");
});

test("P2-06 migration proves RLS, direct-write denial, idempotency, audit redaction, and non-execution", () => {
  const sql = readFileSync("supabase/migrations/20260903000000_p2_06_governed_decision_to_action.sql", "utf8");
  for (const table of ["material_action_proposals", "material_action_governance_evaluations", "material_action_audit_events"]) assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(sql, /unique \(workspace_id, idempotency_key\)/);
  assert.match(sql, /revoke all on public\.material_action_proposals/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /material_action_idempotency_conflict/);
  assert.match(sql.replace(/\s+/g, " "), /taskCreated',false.*dispatched',false.*executed',false.*outcomeCreated',false.*observationCreated',false.*learningElevated',false.*remoteAocWriteback',false/);
  assert.doesNotMatch(sql, /insert into public\.(execution_tasks|outcomes|observations)/i);
});
