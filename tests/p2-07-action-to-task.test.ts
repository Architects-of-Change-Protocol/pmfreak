import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260904000000_p2_07_canonical_action_to_task.sql",
  "utf8",
);
const service = readFileSync(
  "src/lib/operational-flow/operational-flow-service.ts",
  "utf8",
);
const route = readFileSync(
  "src/app/api/operational-flow/route.ts",
  "utf8",
);
const legacyDraftMaterializer = readFileSync(
  "src/lib/task-drafts/materialize-task-draft.ts",
  "utf8",
);

test("P2-07 reuses execution_tasks as the canonical Task and adds no second Task model", () => {
  assert.match(migration, /insert into public\.execution_tasks/);
  assert.doesNotMatch(migration, /create table public\.(?:canonical_)?tasks\b/i);
});

test("P2-07 has a durable one-Action-to-at-most-one-Task invariant", () => {
  assert.match(migration, /create unique index if not exists execution_tasks_governed_action_uidx/);
  assert.match(migration, /source_payload ->> 'sourceActionId'/);
  assert.match(migration, /pg_advisory_xact_lock/);
});

test("P2-07 resolves persisted latest governance and fails closed", () => {
  assert.match(migration, /order by evaluated_at desc, recorded_at desc/);
  assert.match(migration, /governance_state not in \('authorized', 'not_required'\)/);
  assert.match(migration, /not v_evaluation\.can_commit_action/);
  assert.match(migration, /v_action\.expires_at <= pg_catalog\.now\(\)/);
  assert.match(migration, /v_evaluation\.valid_until is not null/);
  assert.match(migration, /policy_or_grant_reference_missing/);
});

test("P2-07 revocation before Task creation is denied by latest evaluation semantics", () => {
  assert.match(migration, /governance_state not in \('authorized', 'not_required'\)/);
  assert.match(migration, /governed_action_not_dispatchable/);
});

test("P2-07 server owns mapping and accepts no arbitrary Task fields", () => {
  assert.match(service, /dispatchGovernedMaterialActionToTask/);
  assert.match(service, /p_action_id: actionId/);
  assert.doesNotMatch(
    service.match(/export async function dispatchGovernedMaterialActionToTask[\s\S]*?\/\*\* P2-06 revocation/)?.[0] ?? "",
    /\btitle\b|\bdueDate\b|\bpriority\b|\bassigneeId\b/,
  );
});

test("P2-07 public operation is an explicit Action-to-Task transition", () => {
  assert.match(route, /dispatch_material_action_to_task/);
  assert.match(route, /dispatchGovernedMaterialActionToTask/);
  assert.match(route, /actionId: String\(body\.actionId/);
});

test("legacy governed Recommendation -> Task Draft bypass remains blocked", () => {
  assert.match(
    legacyDraftMaterializer,
    /Governed recommendations must be decided through the evidence-backed operational decision flow/,
  );
});

test("governed Task provenance cannot be forged or rewritten by ordinary writes", () => {
  assert.match(migration, /pmfreak\.p2_07_canonical_dispatch/);
  assert.match(migration, /governed_task_provenance_immutable/);
  assert.match(migration, /governed_task_provenance_cannot_be_forged/);
  assert.match(migration, /set_config\('pmfreak\.p2_07_canonical_dispatch', '1', true\)/);
});

test("P2-07 writes auditable lineage but never claims execution or Outcome", () => {
  assert.match(migration, /'sourceActionId'/);
  assert.match(migration, /'sourceDecisionId'/);
  assert.match(migration, /'governanceEvaluationId'/);
  assert.match(migration, /'policyReference'/);
  assert.match(migration, /'grantReferences'/);
  assert.match(migration, /'obligationReferences'/);
  assert.match(migration, /'approvalReferences'/);
  assert.match(migration, /'evidenceReferences'/);
  assert.match(migration, /'correlationId'/);
  assert.match(migration, /'causationId'/);
  assert.match(migration, /'executed', false/);
  assert.match(migration, /'outcomeCreated', false/);
  assert.doesNotMatch(migration, /insert into public\.[a-z0-9_]*outcome/i);
});

test("P2-07 preserves the remote-AOC no-write boundary", () => {
  assert.match(migration, /'remoteAocWriteback', false/);
  assert.doesNotMatch(migration, /allowDecisionWriteback\s*=\s*true/);
});