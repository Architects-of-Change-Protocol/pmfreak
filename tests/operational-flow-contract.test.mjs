import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";

const migration = readFileSync("supabase/migrations/20260611000000_operational_evidence_decision_loop.sql", "utf8");
const service = readFileSync("src/lib/operational-flow/operational-flow-service.ts", "utf8");
const route = readFileSync("src/app/api/operational-flow/route.ts", "utf8");
const ui = readFileSync("src/features/command-center/operational-decision-loop.tsx", "utf8");
const seed = readFileSync("scripts/seed-operational-flow-demo.mjs", "utf8");
const dbVerifier = readFileSync("scripts/check-operational-flow-db.mjs", "utf8");
const legacyWorkflow = readFileSync("src/lib/recommended-actions/decision-workflow.ts", "utf8");
const legacyRoute = readFileSync("src/app/api/recommended-actions/route.ts", "utf8");
const taskMaterializer = readFileSync("src/lib/task-drafts/materialize-task-draft.ts", "utf8");

function tsxProbe(source) {
  return JSON.parse(execFileSync("npx", ["tsx", "--eval", source], { encoding: "utf8" }).trim());
}

test("contract: migration defines role-aware RLS and closes direct writes to derived audit tables", () => {
  assert.match(migration, /can_write_operational_project[\s\S]*in \('owner','admin','pm'\)/);
  assert.match(migration, /evidence_items_writer_insert[\s\S]*can_write_operational_project/);
  for (const table of ["operational_signals", "governance_events", "operational_decision_records", "agent_runs"]) {
    assert.match(migration, new RegExp(`${table}[^]*enable row level security`));
    assert.doesNotMatch(migration, new RegExp(`create policy ${table}_scoped_insert`));
  }
  assert.match(migration, /decision_evidence_links_scoped_select/);
  assert.doesNotMatch(migration, /create policy decision_evidence_links_scoped_insert/);
});

test("contract: immutable audit trail freezes evidence and snapshots exact decision evidence", () => {
  assert.match(migration, /foreach t in array array\['operational_signals','governance_events','operational_decision_records','decision_evidence_links','agent_runs','agent_outputs'\]/);
  assert.match(migration, /frozen_evidence_is_immutable/);
  assert.match(migration, /evidence_hash_at_decision/);
  assert.match(migration, /evidence_version_at_decision/);
  assert.match(migration, /evidence_title_snapshot/);
  assert.match(migration, /prepare_decision_evidence_link/);
  assert.match(migration, /decision_evidence_lineage_mismatch/);
});

test("contract: run_chain is one transactional root-derived RPC and reprocessing is non-destructive", () => {
  assert.match(service, /rpc\("materialize_operational_chain"/);
  assert.doesNotMatch(route, /create_risk_issue|run_governance_check|create_recommendation|link_evidence/);
  assert.match(migration, /on conflict \(evidence_item_id,signal_type\) do nothing/);
  assert.match(migration, /on conflict \(signal_id\) do nothing/);
  assert.match(migration, /on conflict \(related_entity_id,rule_key\) do nothing/);
  assert.doesNotMatch(migration, /do update set status='open'/);
  assert.match(migration, /guard_risk_issue_human_update/);
});

test("contract: decision RPC derives lineage, evaluates authority, snapshots evidence and transitions recommendation atomically", () => {
  assert.match(migration, /create or replace function public\.record_operational_decision/);
  assert.match(migration, /operational_authority_evaluation/);
  assert.match(migration, /operational_decision_authority_denied/);
  assert.match(migration, /join public\.operational_signals s/);
  assert.match(migration, /insert into public\.decision_evidence_links/);
  assert.match(migration, /update public\.recommended_actions set status=target_status/);
  assert.match(migration, /operational_decision_terminal_recommendation_uidx/);
  assert.doesNotMatch(service, /authorityBasis|authority_basis/);
});

test("authority mapping denies read-only/non-human roles and restricts PM sponsor authority", () => {
  const result = tsxProbe(`import { evaluateOperationalDecisionAuthority as e } from './src/lib/operational-flow/authority.ts'; console.log(JSON.stringify({contributor:e({actorRole:'contributor',authorityRequired:'sponsor or PMO',decisionStatus:'accepted'}),viewer:e({actorRole:'viewer',authorityRequired:'baseline review',decisionStatus:'accepted'}),agent:e({actorRole:'ai_agent',authorityRequired:'baseline review',decisionStatus:'accepted'}),pmSponsor:e({actorRole:'pm',authorityRequired:'sponsor or PMO',decisionStatus:'accepted'}),pmBaseline:e({actorRole:'pm',authorityRequired:'baseline review',decisionStatus:'accepted'}),admin:e({actorRole:'admin',authorityRequired:'sponsor or PMO',decisionStatus:'accepted'})}));`);
  assert.equal(result.contributor.allowed, false);
  assert.equal(result.viewer.allowed, false);
  assert.equal(result.agent.allowed, false);
  assert.equal(result.pmSponsor.allowed, false);
  assert.equal(result.pmBaseline.allowed, true);
  assert.equal(result.admin.allowed, true);
});

test("deterministic detector honestly finds the demo signals", () => {
  const result = tsxProbe(`import { detectOperationalSignals } from './src/lib/operational-flow/deterministic-signal-detector.ts'; console.log(JSON.stringify(detectOperationalSignals({title:'Client scope request',content:'Additional work outside scope without formal approval.'}).map(x=>x.signalType).sort()));`);
  assert.deepEqual(result, ["missing_approval", "scope_creep"]);
  assert.match(ui, /not AI or an autonomous agent/);
  assert.match(ui, /Rule score/);
});

test("legacy recommendation surfaces cannot decide or convert governed recommendations", () => {
  assert.match(legacyWorkflow, /Governed recommendations must be decided through the evidence-backed operational decision flow\./);
  assert.match(legacyWorkflow, /requireProjectAccess\(action\.project_id, "write"\)/);
  assert.match(legacyRoute, /\.is\("governance_event_id", null\)/);
  assert.match(taskMaterializer, /governance_event_id/);
  assert.match(taskMaterializer, /governed_flow_required/);
  assert.match(taskMaterializer, /requireProjectAccess\(action\.project_id, "write"\)/);
});

test("project assurance uses exact count queries rather than the 30-row feed", () => {
  assert.match(migration, /get_operational_assurance_summary/);
  assert.match(migration, /select count\(\*\) from public\.governance_events/);
  assert.match(service, /\.limit\(30\)/);
  assert.match(ui, /Project Assurance Summary v1 · exact project counts/);
  assert.doesNotMatch(ui, /Enterprise Assurance View/);
  assert.match(dbVerifier, /length: 35/);
  assert.match(dbVerifier, /totalGovernanceEvents > 30/);
});

test("Command Center starts with evidence and uses honest non-workflow action labels", () => {
  for (const text of ["Latest project evidence", "Recorded; no deterministic signal matched.", "Evidence", "Detected signal", "Governance check", "Recommended action", "Human decision"]) assert.match(ui, new RegExp(text));
  for (const text of ["Record modification rationale", "Record escalation decision", "Mark as needing more evidence"]) assert.match(ui, new RegExp(text));
  assert.doesNotMatch(ui, />Escalate</);
  assert.doesNotMatch(ui, />Ask for more evidence</);
});

test("seed has a stable scenario key, reset isolation and owner/admin authority gate", () => {
  assert.match(seed, /client_scope_alignment_v1/);
  assert.match(seed, /stableId/);
  assert.match(seed, /--reset/);
  assert.match(seed, /demoScenarioKey/);
  assert.match(seed, /\["owner", "admin"\]/);
  assert.match(seed, /disposition/);
  assert.doesNotMatch(seed, /workspaceId\s*=\s*["'][0-9a-f-]{36}/i);
});

test("real DB/RLS verifier fails explicitly when isolated Supabase infrastructure is absent", () => {
  const result = spawnSync(process.execPath, ["scripts/check-operational-flow-db.mjs"], { encoding: "utf8", env: {} });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /requires an isolated, migrated Supabase project/);
  for (const probe of ["viewer evidence insert", "normal-user signal insert", "cross-workspace write", "authority denial", "totalGovernanceEvents > 30"]) assert.match(dbVerifier, new RegExp(probe));
});
