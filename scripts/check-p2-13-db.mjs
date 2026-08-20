#!/usr/bin/env node
/**
 * P2-13 runtime acceptance gate.
 *
 * Executes the operator lifecycle end to end against the disposable local
 * stack and proves the properties P2-13 claims — including every required
 * negative — rather than asserting them from source shape.
 *
 * Sequence (P2-13 §27):
 *   precheck -> sentinel -> verify-before -> seed -> verify -> seed again
 *   -> concurrent seed -> negatives -> reset -> residue/sentinel proof
 *   -> reseed -> final verify
 *
 * NEVER run this against anything but an isolated, disposable local stack.
 * The isolation guard refuses any other target before a client is built.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

import {
  EXPECTED_CHAIN_COUNTS,
  FIXTURE_EVIDENCE_STATE,
  FIXTURE_LABEL,
  P2_13_SCENARIO_ID,
  P2_13_TENANTS,
  SCENARIO_ACTOR_EMAILS,
} from "./p2-13/founder-scenario-manifest.mjs";
import { GUARD_MODES, classifyP2_13Target } from "./p2-13/isolation-guard.mjs";
import { buildResetSql, resolveSqlRunner } from "./p2-13/fixture-cleanup.mjs";
import { createSecretRedactor } from "./p2-13/observability.mjs";

const env = process.env;

const verdict = classifyP2_13Target(env, { mode: GUARD_MODES.DESTRUCTIVE });
if (!verdict.ok) {
  console.error(
    [
      "P2-13 runtime acceptance requires the disposable local PMFreak stack and explicit opt-in.",
      "Refused signals:",
      ...verdict.signals.filter((entry) => !entry.ok).map((entry) => `  - ${entry.signal}: ${entry.detail}`),
    ].join("\n"),
  );
  process.exit(2);
}

const supabaseUrl = env.OPERATIONAL_FLOW_TEST_SUPABASE_URL;
const anonKey = env.OPERATIONAL_FLOW_TEST_ANON_KEY;
const serviceRoleKey = env.OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY;
const actorPassword = env.P2_13_FIXTURE_ACTOR_PASSWORD;

const SECRETS = [serviceRoleKey, anonKey, actorPassword, env.OPERATIONAL_FLOW_TEST_DATABASE_URL].filter(Boolean);
const redact = createSecretRedactor(SECRETS);

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(supabaseUrl, serviceRoleKey, clientOptions);
const anonClient = () => createClient(supabaseUrl, anonKey, clientOptions);

let assertions = 0;
const checks = [];
const capturedOutput = [];

const check = (condition, message) => {
  assert.ok(condition, message);
  assertions += 1;
};
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  assertions += 1;
};
const record = (name) => checks.push(name);

/** Run the operator CLI as a child process and capture its report. */
function cli(command, overrides = {}) {
  const result = spawnSync(process.execPath, ["scripts/p2-13-founder-scenario.mjs", command], {
    encoding: "utf8",
    env: { ...env, ...overrides },
    maxBuffer: 32 * 1024 * 1024,
  });
  capturedOutput.push(result.stdout ?? "", result.stderr ?? "");
  let payload = null;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    payload = null;
  }
  return { status: result.status, payload, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

const sqlRunner = resolveSqlRunner(env);
check(sqlRunner.ok, `a local SQL runner must be reachable: ${sqlRunner.reason ?? ""}`);

/** Read-only SQL. Used only to recompute digests and inspect trigger state. */
function readSql(sql) {
  const result = sqlRunner.execute(sql);
  if (result.status !== 0) {
    throw new Error(`read_sql_failed:${redact(String(result.stderr ?? result.stdout ?? ""))}`);
  }
  return String(result.stdout ?? "");
}

// ─────────────────────────────────────────────────────────────────────────
// Sentinel: unrelated data that RESET must never touch (P2-13 §14)
// ─────────────────────────────────────────────────────────────────────────

const sentinel = {
  workspaceId: randomUUID(),
  projectId: randomUUID(),
  email: `p2-13-sentinel-${randomUUID().slice(0, 8)}@example.test`,
  password: `Sentinel-${randomUUID()}!`,
  sourceKey: `p2-13-sentinel-source:${randomUUID().slice(0, 8)}`,
  userId: null,
  evidenceId: null,
};

async function createSentinel() {
  const created = await admin.auth.admin.createUser({
    email: sentinel.email,
    password: sentinel.password,
    email_confirm: true,
  });
  assert.ifError(created.error);
  sentinel.userId = created.data.user.id;

  assert.ifError(
    (await admin.from("workspaces").insert({
      id: sentinel.workspaceId,
      name: "P2-13 sentinel workspace (must survive reset)",
      created_by_user_id: sentinel.userId,
    })).error,
  );
  assert.ifError(
    (await admin.from("workspace_memberships").insert({
      workspace_id: sentinel.workspaceId,
      user_id: sentinel.userId,
      role: "owner",
    })).error,
  );
  assert.ifError(
    (await admin.from("projects").insert({
      id: sentinel.projectId,
      workspace_id: sentinel.workspaceId,
      user_id: sentinel.userId,
      name: "P2-13 sentinel project",
    })).error,
  );

  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email: sentinel.email, password: sentinel.password });
  assert.ifError(signIn.error);

  // A full canonical chain, so a mis-scoped reset would visibly damage it.
  const captured = await client.rpc("capture_operational_input", {
    p_workspace_id: sentinel.workspaceId,
    p_project_id: sentinel.projectId,
    p_source_key: sentinel.sourceKey,
    p_idempotency_key: `sentinel-${randomUUID()}`,
    p_title: "Sentinel record",
    p_content: "An additional activity was requested without formal approval.",
    p_occurred_at: new Date().toISOString(),
    p_correlation_id: randomUUID(),
    p_causation_id: null,
    p_external_id: null,
  });
  assert.ifError(captured.error);

  const derived = await client.rpc("derive_operational_evidence", {
    p_workspace_id: sentinel.workspaceId,
    p_project_id: sentinel.projectId,
    p_normalized_event_id: captured.data.normalizedEvent.id,
    p_idempotency_key: `sentinel-evidence-${randomUUID()}`,
    p_assertion_type: "FACT",
    p_classification: "DECISION_CONTEXT",
    p_confidence_score: 0.9,
    p_missing_data_state: "COMPLETE",
    p_evaluated_at: new Date().toISOString(),
    p_stale_at: null,
  });
  assert.ifError(derived.error);
  sentinel.evidenceId = derived.data.evidence.id;

  assert.ifError((await client.rpc("materialize_operational_chain", { p_evidence_item_id: sentinel.evidenceId })).error);
  return client;
}

async function sentinelFootprint() {
  const counts = {};
  for (const [table, apply] of [
    ["workspaces", (q) => q.eq("id", sentinel.workspaceId)],
    ["projects", (q) => q.eq("id", sentinel.projectId)],
    ["workspace_memberships", (q) => q.eq("workspace_id", sentinel.workspaceId)],
    ["operational_sources", (q) => q.eq("workspace_id", sentinel.workspaceId)],
    ["operational_raw_inputs", (q) => q.eq("workspace_id", sentinel.workspaceId)],
    ["operational_normalized_events", (q) => q.eq("workspace_id", sentinel.workspaceId)],
    ["evidence_items", (q) => q.eq("workspace_id", sentinel.workspaceId)],
    ["operational_signals", (q) => q.eq("workspace_id", sentinel.workspaceId)],
    ["recommended_actions", (q) => q.eq("workspace_id", sentinel.workspaceId)],
  ]) {
    const result = await apply(admin.from(table).select("*", { count: "exact", head: true }));
    assert.ifError(result.error);
    counts[table] = result.count ?? 0;
  }
  return counts;
}

async function destroySentinel() {
  const sql = buildResetSql({
    workspaceIds: [sentinel.workspaceId],
    projectIds: [sentinel.projectId],
    inviteIds: [],
    actorEmails: [sentinel.email],
  });
  const result = sqlRunner.execute(sql);
  if (result.status !== 0) {
    console.error(`sentinel cleanup failed: ${redact(String(result.stderr ?? ""))}`);
  }
  if (sentinel.userId) await admin.auth.admin.deleteUser(sentinel.userId);
}

// ─────────────────────────────────────────────────────────────────────────

async function actorClientFor(tenantKey, actorKey) {
  const tenant = P2_13_TENANTS.find((entry) => entry.key === tenantKey);
  const actor = tenant.actors.find((entry) => entry.key === actorKey);
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email: actor.email, password: actorPassword });
  assert.ifError(signIn.error);
  return { client, tenant, actor, userId: signIn.data.user.id };
}

const uuidList = (values) => values.map((value) => `'${value}'::uuid`).join(",");

try {
  // ── 1. PRECHECK ────────────────────────────────────────────────────────
  const preflight = cli("preflight");
  equal(preflight.status, 0, "preflight exits 0 on a proven-local target");
  equal(preflight.payload?.databaseTargetClassification, "LOCAL_ISOLATED", "target classified LOCAL_ISOLATED");
  record("precheck proves LOCAL_ISOLATED");

  // ── 2. Isolation guard fails closed (negatives 1 and 2) ────────────────
  const remoteAttempt = cli("seed", {
    OPERATIONAL_FLOW_TEST_SUPABASE_URL: "https://example-project.supabase.co",
    NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co",
  });
  equal(remoteAttempt.status, 2, "a remote Supabase target is refused");
  equal(remoteAttempt.payload?.status, "REFUSED", "the refusal is reported explicitly");
  check(
    remoteAttempt.payload.refusals.includes("supabase_url_loopback") &&
      remoteAttempt.payload.refusals.includes("no_known_hosted_or_production_host"),
    "a remote target is refused by more than one independent signal",
  );
  record("remote/non-isolated target refused");

  const noOptIn = cli("seed", { P2_13_FOUNDER_FIXTURE_ENABLED: "false" });
  equal(noOptIn.status, 2, "seed without the explicit P2-13 opt-in is refused");
  check(noOptIn.payload.refusals.includes("explicit_p2_13_opt_in"), "the missing opt-in is named");
  record("missing explicit seed opt-in refused");

  const noResetOptIn = cli("reset", { P2_13_ALLOW_LOCAL_RESET: "false" });
  equal(noResetOptIn.status, 2, "reset without the explicit destructive opt-in is refused");
  check(noResetOptIn.payload.refusals.includes("explicit_local_reset_opt_in"), "the missing reset opt-in is named");
  record("missing destructive opt-in refuses reset");

  const remoteOverride = cli("seed", { OPERATIONAL_FLOW_TEST_ALLOW_REMOTE: "true" });
  equal(remoteOverride.status, 2, "P2-13 never honours the remote override flag");
  record("remote override flag cannot unlock P2-13");

  // ── 3. Sentinel + clean start ──────────────────────────────────────────
  await createSentinel();
  const sentinelBefore = await sentinelFootprint();
  check(Object.values(sentinelBefore).every((count) => count > 0), "sentinel data exists before reset");
  record("unrelated sentinel established");

  const verifyBefore = cli("verify");
  if (verifyBefore.payload?.status !== "ABSENT") {
    const cleared = cli("reset");
    equal(cleared.status, 0, "pre-existing scenario is cleared before the acceptance run");
  }
  const verifyAbsent = cli("verify");
  equal(verifyAbsent.payload?.status, "ABSENT", "verify reports ABSENT before the scenario is seeded");
  equal(verifyAbsent.status, 1, "verify exits non-zero when the scenario is not complete");
  record("verify-before reports scenario absent");

  // ── 4. SEED #1 ─────────────────────────────────────────────────────────
  const seed1 = cli("seed");
  equal(seed1.status, 0, "seed #1 succeeds");
  equal(seed1.payload.status, "COMPLETE", "seed #1 reports COMPLETE");
  equal(seed1.payload.verification.status, "COMPLETE", "seed #1 self-verification is COMPLETE");
  check(Boolean(seed1.payload.handoff), "a successful seed emits the P2-14 handoff manifest");
  record("seed #1 creates the deterministic scenario");

  const seed1Tenants = seed1.payload.verification.tenants;
  for (const tenant of seed1Tenants) {
    equal(tenant.nodes.findingSignals.length, EXPECTED_CHAIN_COUNTS.signals, `${tenant.tenant}: exact signal count`);
    equal(tenant.nodes.findingRiskIssues, EXPECTED_CHAIN_COUNTS.riskIssueRecords, `${tenant.tenant}: exact risk/issue count`);
    equal(tenant.nodes.findingGovernanceEvents, EXPECTED_CHAIN_COUNTS.governanceEvents, `${tenant.tenant}: exact governance count`);
    equal(tenant.nodes.recommendations.length, EXPECTED_CHAIN_COUNTS.recommendations, `${tenant.tenant}: exact recommendation count`);
    for (const [state, count] of Object.entries(tenant.downstreamOwnedByP2_14)) {
      equal(count, 0, `${tenant.tenant}: ${state} must be created by P2-14, not preseeded`);
    }
  }
  record("preseeded spine stops at Recommendation; downstream belongs to P2-14");

  // ── 5. SEED #2 — idempotency (negative 3) ──────────────────────────────
  const seed2 = cli("seed");
  equal(seed2.status, 0, "seed #2 succeeds");
  equal(seed2.payload.status, "COMPLETE", "seed #2 reports COMPLETE");
  const intakeStage = seed2.payload.stages.find((stage) => stage.name === "canonical_intake");
  const evidenceStage = seed2.payload.stages.find((stage) => stage.name === "canonical_evidence");
  for (const tenant of P2_13_TENANTS) {
    equal(intakeStage.detail.dispositions[tenant.key], "duplicate", `${tenant.key}: intake replay is a duplicate`);
    equal(evidenceStage.detail.dispositions[tenant.key], "duplicate", `${tenant.key}: evidence replay is a duplicate`);
  }
  equal(
    JSON.stringify(seed2.payload.verification.tenants.map((t) => t.nodes)),
    JSON.stringify(seed1Tenants.map((t) => t.nodes)),
    "seed #2 produces byte-identical canonical node identities",
  );
  equal(
    JSON.stringify(seed2.payload.verification.tenants.map((t) => t.provenance)),
    JSON.stringify(seed1Tenants.map((t) => t.provenance)),
    "seed #2 produces byte-identical provenance digests",
  );

  // The Finding fan-out is re-entered only when a branch is missing, so an
  // unchanged scenario appends no second detector run.
  const chainStage = seed2.payload.stages.find((stage) => stage.name === "canonical_finding_and_recommendation");
  for (const entry of chainStage.detail.chains) {
    equal(
      entry.disposition,
      "already_materialized",
      `${entry.tenant}: an intact chain is not re-materialized on replay`,
    );
  }
  for (const tenant of seed2.payload.verification.tenants) {
    equal(tenant.nodes.detectorRuns, 1, `${tenant.tenant}: exactly one detector run after two seeds`);
  }

  // Row-count delta across the whole scenario footprint, including the tables
  // `verify` addresses by identity rather than by count. A duplicate anywhere
  // in the scenario's own footprint fails here even if no id changed.
  const scenarioFootprint = async () => {
    const counts = {};
    for (const table of ["agent_runs", "operational_sources", "operational_raw_inputs",
      "operational_normalized_events", "evidence_items", "operational_signals",
      "risk_issue_records", "governance_events", "recommended_actions", "platform_events",
      "workspace_memberships", "early_access_invites", "trial_licenses", "workspace_activations"]) {
      const result = await admin
        .from(table)
        .select("*", { count: "exact", head: true })
        .in("workspace_id", P2_13_TENANTS.map((t) => t.workspaceId));
      assert.ifError(result.error);
      counts[table] = result.count ?? 0;
    }
    return counts;
  };
  const footprintAfterSeed2 = await scenarioFootprint();
  const seed3 = cli("seed");
  equal(seed3.status, 0, "a third seed succeeds");
  const footprintAfterSeed3 = await scenarioFootprint();
  equal(
    JSON.stringify(footprintAfterSeed3),
    JSON.stringify(footprintAfterSeed2),
    "a further seed changes no row count anywhere in the scenario footprint",
  );
  record("second seed creates zero duplicate canonical nodes");
  record("repeated seed moves no row count in the scenario footprint");

  // ── 6. Concurrent same-seed retry (P2-12 review lesson E) ──────────────
  const [concurrentA, concurrentB] = await Promise.all([
    Promise.resolve().then(() => cli("seed")),
    Promise.resolve().then(() => cli("seed")),
  ]);
  check(
    concurrentA.status === 0 && concurrentB.status === 0,
    "two concurrent seeds of the same scenario both succeed",
  );
  const afterConcurrent = cli("verify");
  equal(afterConcurrent.payload.status, "COMPLETE", "verify remains COMPLETE after concurrent seeds");
  equal(
    JSON.stringify(afterConcurrent.payload.tenants.map((t) => t.nodes)),
    JSON.stringify(seed1Tenants.map((t) => t.nodes)),
    "concurrent seeds create no duplicate canonical node",
  );
  record("concurrent same-seed retry stays idempotent");

  // ── 7. Real provenance (negative 10) ───────────────────────────────────
  const tenantA = seed1Tenants.find((entry) => entry.tenant === "A");
  const tenantB = seed1Tenants.find((entry) => entry.tenant === "B");

  const digestProof = readSql(
    `select r.id::text || '=' || (r.content_digest = 'sha256:' || encode(extensions.digest(convert_to(r.payload::text,'UTF8'),'sha256'),'hex'))::text
     from public.operational_raw_inputs r
     where r.workspace_id in (${uuidList(P2_13_TENANTS.map((t) => t.workspaceId))});`,
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  equal(digestProof.length, P2_13_TENANTS.length, "each tenant has exactly one seeded raw input");
  check(
    digestProof.every((line) => line.endsWith("=true")),
    "each stored raw-input digest is the real sha256 of its stored payload",
  );
  record("raw input digest recomputes from the fixture payload");

  for (const tenant of [tenantA, tenantB]) {
    check(/^sha256:[a-f0-9]{64}$/.test(tenant.provenance.rawContentDigest), "raw digest shape");
    check(/^sha256:[a-f0-9]{64}$/.test(tenant.provenance.normalizedEventDigest), "event digest shape");
    check(/^sha256:[a-f0-9]{64}$/.test(tenant.provenance.evidenceDerivationDigest), "evidence digest shape");
    for (const digest of Object.values(tenant.provenance)) {
      check(
        !/^sha256:0{64}$/.test(String(digest)),
        "no canonical provenance digest (raw content / normalized event / evidence derivation) is zero-filled",
      );
    }
  }
  // Scoped deliberately: this asserts the three canonical P2-03/P2-04 digests
  // P2-13 validates provenance with. It is not a claim about every hash-shaped
  // column in the schema.
  record("canonical P2-03/P2-04 provenance digests are real, never zero-filled");

  // ── 8. Fixture may never read as LIVE Evidence (negative 8) ────────────
  const fixtureEvidence = await admin
    .from("evidence_items")
    .select("id,fixture_state,normalized_event_id")
    .in("workspace_id", P2_13_TENANTS.map((t) => t.workspaceId));
  assert.ifError(fixtureEvidence.error);
  check(fixtureEvidence.data.length > 0, "seeded evidence exists");
  for (const row of fixtureEvidence.data) {
    equal(row.fixture_state, FIXTURE_EVIDENCE_STATE, "seeded evidence is classified DEMO_FIXTURE");
    check(Boolean(row.normalized_event_id), "seeded evidence is derived from a Normalized Event");
  }

  // The exact P2-09 observation-eligibility predicate: fixture evidence must
  // not appear, so an Outcome can never be promoted from it.
  const liveEligible = await admin
    .from("evidence_items")
    .select("id", { count: "exact", head: true })
    .in("workspace_id", P2_13_TENANTS.map((t) => t.workspaceId))
    .eq("fixture_state", "LIVE")
    .eq("freshness_state", "CURRENT")
    .eq("lifecycle", "RECORDED")
    .not("normalized_event_id", "is", null);
  assert.ifError(liveEligible.error);
  equal(liveEligible.count ?? 0, 0, "no seeded fixture evidence satisfies the LIVE observation-eligibility contract");

  const ownerA = await actorClientFor("A", "owner");
  const liveIntakeAttempt = await ownerA.client.rpc("capture_live_operational_input", {
    p_workspace_id: ownerA.tenant.workspaceId,
    p_project_id: ownerA.tenant.projectId,
    p_source_key: ownerA.tenant.intake.sourceKey,
    p_idempotency_key: `p2-13-live-probe-${randomUUID()}`,
    p_title: "Live intake probe",
    p_content: "This must be refused because the source is a fixture source.",
    p_occurred_at: new Date().toISOString(),
    p_correlation_id: randomUUID(),
    p_causation_id: null,
    p_external_id: null,
  });
  check(Boolean(liveIntakeAttempt.error), "live intake through a fixture source is refused");
  check(
    /intake_source_fixture_prohibited/.test(liveIntakeAttempt.error?.message ?? ""),
    "the refusal is the canonical fixture-prohibited contract",
  );
  record("fixture cannot be classified or reused as LIVE Evidence");

  // ── 9. Direct Evidence insertion is not a path (negative 9) ────────────
  const directInsert = await ownerA.client.from("evidence_items").insert({
    id: randomUUID(),
    workspace_id: ownerA.tenant.workspaceId,
    project_id: ownerA.tenant.projectId,
    created_by: ownerA.userId,
    source_type: "manual_note",
    title: "direct insert attempt",
    content: "must be denied",
    source_reference: "test://direct",
    confidence_level: "high",
    status: "recorded",
    version: 1,
  });
  check(Boolean(directInsert.error), "a direct Evidence insert by an authenticated actor is denied");
  record("direct Evidence insertion denied");

  // ── 10. Two-tenant isolation, as real authenticated actors (§28) ────────
  const ownerB = await actorClientFor("B", "owner");

  const aReadsA = await ownerA.client.from("evidence_items").select("id").eq("id", tenantA.nodes.evidence);
  assert.ifError(aReadsA.error);
  equal(aReadsA.data.length, 1, "Tenant A actor reads Tenant A evidence");

  const bReadsB = await ownerB.client.from("evidence_items").select("id").eq("id", tenantB.nodes.evidence);
  assert.ifError(bReadsB.error);
  equal(bReadsB.data.length, 1, "Tenant B actor reads Tenant B evidence");

  for (const [reader, foreignTenant, label] of [
    [ownerA, tenantB, "A->B"],
    [ownerB, tenantA, "B->A"],
  ]) {
    for (const [table, column, value] of [
      ["evidence_items", "id", foreignTenant.nodes.evidence],
      ["operational_raw_inputs", "id", foreignTenant.nodes.rawInput],
      ["operational_normalized_events", "id", foreignTenant.nodes.normalizedEvent],
      ["operational_signals", "id", foreignTenant.nodes.findingSignals[0]],
      ["recommended_actions", "id", foreignTenant.nodes.recommendations[0]],
    ]) {
      const read = await reader.client.from(table).select("id").eq(column, value);
      assert.ifError(read.error);
      equal(read.data.length, 0, `${label}: cross-tenant ${table} read is filtered by RLS`);
    }
  }
  record("cross-tenant lineage reads denied in both directions");

  // Cross-tenant write, and cross-workspace/cross-project id substitution.
  const crossTenantWrite = await ownerA.client.rpc("capture_operational_input", {
    p_workspace_id: ownerB.tenant.workspaceId,
    p_project_id: ownerB.tenant.projectId,
    p_source_key: "p2-13-cross-tenant-probe:v1",
    p_idempotency_key: `p2-13-cross-${randomUUID()}`,
    p_title: "cross tenant write",
    p_content: "must be denied",
    p_occurred_at: new Date().toISOString(),
    p_correlation_id: randomUUID(),
    p_causation_id: null,
    p_external_id: null,
  });
  check(Boolean(crossTenantWrite.error), "Tenant A actor cannot write into Tenant B");
  check(/intake_access_denied/.test(crossTenantWrite.error?.message ?? ""), "the cross-tenant write denial is explicit");

  const substituted = await ownerA.client.rpc("capture_operational_input", {
    p_workspace_id: ownerA.tenant.workspaceId,
    p_project_id: ownerB.tenant.projectId,
    p_source_key: "p2-13-substitution-probe:v1",
    p_idempotency_key: `p2-13-sub-${randomUUID()}`,
    p_title: "id substitution",
    p_content: "must be denied",
    p_occurred_at: new Date().toISOString(),
    p_correlation_id: randomUUID(),
    p_causation_id: null,
    p_external_id: null,
  });
  check(Boolean(substituted.error), "workspace/project id substitution is denied server-side");

  const crossChain = await ownerA.client.rpc("materialize_operational_chain", {
    p_evidence_item_id: tenantB.nodes.evidence,
  });
  check(Boolean(crossChain.error), "Tenant A actor cannot materialize a chain over Tenant B evidence");
  record("cross-tenant writes and id substitution denied");

  const viewerA = await actorClientFor("A", "viewer");
  const viewerWrite = await viewerA.client.rpc("capture_operational_input", {
    p_workspace_id: viewerA.tenant.workspaceId,
    p_project_id: viewerA.tenant.projectId,
    p_source_key: "p2-13-viewer-probe:v1",
    p_idempotency_key: `p2-13-viewer-${randomUUID()}`,
    p_title: "viewer write",
    p_content: "must be denied",
    p_occurred_at: new Date().toISOString(),
    p_correlation_id: randomUUID(),
    p_causation_id: null,
    p_external_id: null,
  });
  check(Boolean(viewerWrite.error), "a same-tenant viewer cannot write canonical intake");
  record("same-tenant role negative enforced");

  // ── 11. Missing/invalid canonical prerequisite fails visibly (neg. 11) ──
  const orphanDerivation = await ownerA.client.rpc("derive_operational_evidence", {
    p_workspace_id: ownerA.tenant.workspaceId,
    p_project_id: ownerA.tenant.projectId,
    p_normalized_event_id: randomUUID(),
    p_idempotency_key: `p2-13-orphan-${randomUUID()}`,
    p_assertion_type: "FACT",
    p_classification: "DECISION_CONTEXT",
    p_confidence_score: 0.9,
    p_missing_data_state: "COMPLETE",
    p_evaluated_at: new Date().toISOString(),
    p_stale_at: null,
  });
  check(Boolean(orphanDerivation.error), "Evidence cannot be derived without a real Normalized Event");
  check(
    /normalized_event_not_found_or_scope_mismatch/.test(orphanDerivation.error?.message ?? ""),
    "the missing-prerequisite failure names the exact contract violation",
  );
  record("missing canonical prerequisite fails visibly");

  // ── 12. A conflicting replay is never silently repaired (negative 14) ───
  const conflicting = await ownerA.client.rpc("capture_operational_input", {
    p_workspace_id: ownerA.tenant.workspaceId,
    p_project_id: ownerA.tenant.projectId,
    p_source_key: ownerA.tenant.intake.sourceKey,
    p_idempotency_key: ownerA.tenant.intake.rawIdempotencyKey,
    p_title: ownerA.tenant.intake.title,
    p_content: "Different content under the same idempotency key.",
    p_occurred_at: ownerA.tenant.intake.occurredAt,
    p_correlation_id: ownerA.tenant.intake.correlationId,
    p_causation_id: null,
    p_external_id: null,
  });
  check(Boolean(conflicting.error), "a conflicting replay of a seeded node is rejected");
  check(
    /intake_idempotency_conflict/.test(conflicting.error?.message ?? ""),
    "the conflict is explicit; the seed never silently overwrites a canonical node",
  );
  record("conflicting replay refused; repair requires explicit reset/reseed");

  // ── 13. Verify detects a missing node (negative 13) ─────────────────────
  const removedRecommendations = await admin
    .from("recommended_actions")
    .delete()
    .in("id", tenantA.nodes.recommendations)
    .select("id");
  assert.ifError(removedRecommendations.error);
  equal(removedRecommendations.data.length, EXPECTED_CHAIN_COUNTS.recommendations, "damage applied for the verify probe");

  const damagedVerify = cli("verify");
  equal(damagedVerify.status, 1, "verify exits non-zero on a damaged scenario");
  equal(damagedVerify.payload.status, "INCOMPLETE", "verify reports INCOMPLETE, not ABSENT and not COMPLETE");
  const damagedTenantA = damagedVerify.payload.tenants.find((entry) => entry.tenant === "A");
  check(
    damagedTenantA.problems.some((problem) => problem.startsWith("recommendations:expected_2_got_0")),
    "verify names the exact missing canonical node",
  );
  record("verify detects a missing fixture node exactly");

  // ── 14. Partial seed reports PARTIAL_SEED, never success (negative 12) ──
  const brokenCredentials = cli("seed", { P2_13_FIXTURE_ACTOR_PASSWORD: "not-the-fixture-password" });
  equal(brokenCredentials.status, 1, "a seed that cannot complete exits non-zero");
  equal(brokenCredentials.payload.status, "PARTIAL_SEED", "an incomplete seed reports PARTIAL_SEED");
  equal(
    JSON.stringify(brokenCredentials.payload.completedStages),
    JSON.stringify(["isolation_guard"]),
    "PARTIAL_SEED lists exactly the stages that did complete",
  );
  check(brokenCredentials.payload.unreachedStages.length > 0, "unreached stages are reported, not hidden");
  check(
    /P2_13_REALIGN_FIXTURE_ACTORS/.test(JSON.stringify(brokenCredentials.payload)),
    "the credential failure names the explicit recovery, rather than repairing itself",
  );
  record("partial seed never reports success");


  // Canonical retry repairs the deleted node (P2-13 §13 idempotency contract).
  const repairSeed = cli("seed");
  equal(repairSeed.status, 0, "the canonical idempotent replay restores the missing node");
  const repairedVerify = cli("verify");
  equal(repairedVerify.payload.status, "COMPLETE", "verify is COMPLETE again after the canonical replay");

  // A repair is a real second detector execution and is reported as one — the
  // harness never disguises it as a no-op, and never silently rewrites the
  // first run to keep the number tidy.
  const repairChainStage = repairSeed.payload.stages.find(
    (stage) => stage.name === "canonical_finding_and_recommendation",
  );
  const repairedTenantA = repairChainStage.detail.chains.find((entry) => entry.tenant === "A");
  equal(repairedTenantA.disposition, "repaired", "a damaged chain is replayed and reported as repaired");
  equal(
    repairChainStage.detail.chains.find((entry) => entry.tenant === "B").disposition,
    "already_materialized",
    "the undamaged tenant is not re-materialized by the repair",
  );
  equal(
    repairedVerify.payload.tenants.find((entry) => entry.tenant === "A").nodes.detectorRuns,
    2,
    "the repair replay is visible as a second detector run, not hidden",
  );
  equal(
    repairedVerify.payload.tenants.find((entry) => entry.tenant === "B").nodes.detectorRuns,
    1,
    "the untouched tenant still shows exactly one detector run",
  );
  record("canonical idempotent replay restores a missing derived node");
  record("repair replay is reported honestly as a new detector run");

  // A wrong password must never silently become the fixture password. Recovery
  // exists, but only as an explicit operator decision — and it must not leave
  // the realigned credential in force for the rest of this run.
  const realigned = cli("seed", {
    P2_13_FIXTURE_ACTOR_PASSWORD: "not-the-fixture-password",
    P2_13_REALIGN_FIXTURE_ACTORS: "true",
  });
  equal(realigned.status, 0, "an explicit realign recovers a stranded fixture identity");
  equal(realigned.payload.status, "COMPLETE", "the realigned seed completes");
  const strandedAgain = cli("seed");
  equal(strandedAgain.status, 1, "the original password no longer authenticates after a realign");
  equal(strandedAgain.payload.status, "PARTIAL_SEED", "and that is reported as PARTIAL_SEED, not success");
  const restored = cli("seed", { P2_13_REALIGN_FIXTURE_ACTORS: "true" });
  equal(restored.status, 0, "an explicit realign restores the configured password");
  record("credential realignment requires an explicit opt-in and is never silent");

  // ── 15. RESET: scoped removal, zero residue, sentinel intact ───────────
  const reset = cli("reset");
  equal(reset.status, 0, "reset succeeds");
  equal(reset.payload.status, "COMPLETE", "reset reports COMPLETE");
  equal(reset.payload.residualTables.length, 0, "reset leaves zero P2-13 residue");
  for (const [table, count] of Object.entries(reset.payload.residueAfter)) {
    equal(count, 0, `reset residue for ${table} is zero`);
  }
  equal(cli("verify").payload.status, "ABSENT", "verify reports ABSENT after reset");
  record("reset removes only the P2-13 fixture scenario");

  const sentinelAfter = await sentinelFootprint();
  equal(JSON.stringify(sentinelAfter), JSON.stringify(sentinelBefore), "unrelated sentinel data is untouched by reset");
  record("unrelated sentinel survives reset intact");

  const survivingActors = [];
  for (const email of SCENARIO_ACTOR_EMAILS) {
    const probe = anonClient();
    const signIn = await probe.auth.signInWithPassword({ email, password: actorPassword });
    if (!signIn.error) survivingActors.push(email);
  }
  equal(survivingActors.length, 0, "fixture auth actors are removed by reset");
  record("fixture identities removed by reset");

  // ── 16. RESEED: same deterministic scenario ────────────────────────────
  const reseed = cli("reseed");
  equal(reseed.status, 0, "reseed succeeds");
  equal(reseed.payload.seed.status, "COMPLETE", "reseed recreates a COMPLETE scenario");

  const reseedTenants = reseed.payload.seed.verification.tenants;
  for (const before of seed1Tenants) {
    const after = reseedTenants.find((entry) => entry.tenant === before.tenant);
    equal(after.workspaceId, before.workspaceId, `${before.tenant}: workspace id is deterministic across reseed`);
    equal(after.projectId, before.projectId, `${before.tenant}: project id is deterministic across reseed`);
    equal(after.nodes.founderInvite, before.nodes.founderInvite, `${before.tenant}: invite id is deterministic`);
    equal(after.nodes.trialLicense, before.nodes.trialLicense, `${before.tenant}: trial id is deterministic`);
    equal(
      after.provenance.rawContentDigest,
      before.provenance.rawContentDigest,
      `${before.tenant}: raw content digest is byte-identical across reseed`,
    );
    equal(
      after.provenance.normalizedEventDigest,
      before.provenance.normalizedEventDigest,
      `${before.tenant}: normalized event digest is byte-identical across reseed`,
    );
    equal(
      after.provenance.correlationId,
      before.provenance.correlationId,
      `${before.tenant}: correlation id is deterministic across reseed`,
    );
    // Contract-generated primary keys are minted by the verified RPCs, so a
    // reseed legitimately produces new ones. Recorded, never asserted equal.
    check(
      after.nodes.evidence !== before.nodes.evidence,
      `${before.tenant}: contract-generated evidence id is newly minted, as the derivation boundary requires`,
    );
  }
  record("reseed recreates the same deterministic scenario");

  const finalVerify = cli("verify");
  equal(finalVerify.status, 0, "final verify exits 0");
  equal(finalVerify.payload.status, "COMPLETE", "final verify is COMPLETE");
  record("final verify reports the exact expected state");

  const sentinelFinal = await sentinelFootprint();
  equal(JSON.stringify(sentinelFinal), JSON.stringify(sentinelBefore), "sentinel is still intact after reseed");

  // ── 17. Secrets never printed (negative 15) ────────────────────────────
  const allOutput = capturedOutput.join("\n");
  for (const secret of SECRETS) {
    check(!allOutput.includes(secret), "no configured secret value appears in harness output");
  }
  check(!/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\./.test(allOutput), "no JWT appears in harness output");
  check(!/\bsb_secret_[A-Za-z0-9_-]{8,}/.test(allOutput), "no Supabase secret key appears in harness output");
  check(!/postgres(?:ql)?:\/\/[^\s"']*:[^\s"']*@/.test(allOutput), "no database URL with credentials appears in harness output");
  record("no secret is printed by the harness");

  // ── 18. Source-shape supplements (never the sole proof) ────────────────
  const harnessSources = [
    "scripts/p2-13-founder-scenario.mjs",
    "scripts/p2-13/founder-scenario-manifest.mjs",
    "scripts/p2-13/isolation-guard.mjs",
    "scripts/p2-13/fixture-cleanup.mjs",
    "scripts/p2-13/observability.mjs",
  ].map((path) => ({ path, text: readFileSync(path, "utf8") }));

  for (const { path, text } of harnessSources) {
    check(
      !/from\(\s*["']evidence_items["']\s*\)\s*\.\s*insert/.test(text),
      `${path} never inserts Evidence directly`,
    );
    check(!/repeat\(\s*["']0["']/.test(text) && !/"0"\.repeat\(64\)/.test(text), `${path} contains no placeholder hash`);
    check(!/DISABLE\s+TRIGGER\s+ALL/i.test(text), `${path} never disables all triggers`);
    check(!/session_replication_role/i.test(text), `${path} never disables foreign keys`);
    check(!/disable\s+row\s+level\s+security/i.test(text), `${path} never disables RLS`);
    // Match a real statement, not the word in a comment: `truncate` must be
    // followed by whitespace and an identifier to count.
    check(
      !/\btruncate\s+(?:table\s+)?(?:only\s+)?["a-z_]/i.test(text),
      `${path} never truncates a table`,
    );
    check(!/\bdrop\s+(schema|table|database)\b/i.test(text), `${path} never drops schema objects`);
  }
  record("harness source contains no bypass, truncation or placeholder digest");

  console.log(
    JSON.stringify(
      {
        ok: true,
        scenarioId: P2_13_SCENARIO_ID,
        databaseTargetClassification: verdict.classification,
        fixtureLabel: FIXTURE_LABEL,
        assertions,
        checks,
      },
      null,
      2,
    ),
  );
} finally {
  await destroySentinel();
}
