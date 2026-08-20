/**
 * P2-13 — focused tests for the Founder Invite seed and isolated environment
 * harness.
 *
 * These cover the pure decision logic (isolation guard, deterministic
 * manifest, cleanup ordering, secret redaction, stage accounting) that must
 * hold with no infrastructure. Runtime behaviour — seed, verify, reset,
 * reseed, two-tenant RLS, real provenance — is proven separately by
 * `npm run check:p2-13-db` against the disposable local stack; source shape
 * alone is never the acceptance evidence.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CANONICAL_SPINE_OWNERSHIP,
  EXPECTED_CHAIN_COUNTS,
  FIXTURE_EVIDENCE_STATE,
  FIXTURE_EXPIRY_OWNER,
  FIXTURE_LABEL,
  P2_13_SCENARIO_ID,
  P2_13_TENANTS,
  SCENARIO_ACTOR_EMAILS,
  SCENARIO_PROJECT_IDS,
  SCENARIO_WORKSPACE_IDS,
  actorFor,
  buildP2_14HandoffManifest,
  deterministicUuid,
  tenantByKey,
} from "../scripts/p2-13/founder-scenario-manifest.mjs";
import {
  EXPECTED_APP_ORIGIN,
  EXPECTED_DATABASE_PORT,
  EXPECTED_SUPABASE_PORT,
  GUARD_MODES,
  LOCAL_ISOLATED,
  assertIsolatedTarget,
  classifyP2_13Target,
} from "../scripts/p2-13/isolation-guard.mjs";
import {
  FIXTURE_CLEANUP_PLAN,
  UNEXEMPTED_IMMUTABILITY_TRIGGERS,
  buildResetSql,
  parseResetCounts,
  resolveSqlRunner,
} from "../scripts/p2-13/fixture-cleanup.mjs";
import {
  RUN_STATUS,
  createSecretRedactor,
  createStageTracker,
  safeFailureReason,
} from "../scripts/p2-13/observability.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A fully valid local configuration, used as the baseline for each negative. */
const LOCAL_ENV = Object.freeze({
  P2_13_FOUNDER_FIXTURE_ENABLED: "true",
  P2_13_ALLOW_LOCAL_RESET: "true",
  OPERATIONAL_FLOW_TEST_ALLOW_DESTRUCTIVE: "true",
  OPERATIONAL_FLOW_TEST_SUPABASE_URL: `http://127.0.0.1:${EXPECTED_SUPABASE_PORT}`,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${EXPECTED_SUPABASE_PORT}`,
  OPERATIONAL_FLOW_TEST_BASE_URL: EXPECTED_APP_ORIGIN,
  OPERATIONAL_FLOW_TEST_DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${EXPECTED_DATABASE_PORT}/postgres`,
  OPERATIONAL_FLOW_TEST_ANON_KEY: "local-anon",
  OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY: "local-service-role",
  P2_13_FIXTURE_ACTOR_PASSWORD: "a-sufficiently-long-fixture-password",
  NODE_ENV: "test",
});

// ── isolation guard ───────────────────────────────────────────────────────

test("P2-13 guard allows a proven local isolated target", () => {
  for (const mode of Object.values(GUARD_MODES)) {
    const verdict = classifyP2_13Target(LOCAL_ENV, { mode });
    assert.equal(verdict.ok, true, `${mode}: ${verdict.refusals.join(",")}`);
    assert.equal(verdict.classification, LOCAL_ISOLATED);
  }
});

test("P2-13 guard fails closed on an empty environment", () => {
  const verdict = classifyP2_13Target({}, { mode: GUARD_MODES.DESTRUCTIVE });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.classification, "UNKNOWN");
  assert.ok(verdict.refusals.includes("explicit_p2_13_opt_in"));
  assert.ok(verdict.refusals.includes("supabase_url_parsable"));
});

test("P2-13 guard refuses a hosted Supabase target on more than one signal", () => {
  const verdict = classifyP2_13Target(
    {
      ...LOCAL_ENV,
      OPERATIONAL_FLOW_TEST_SUPABASE_URL: "https://project-ref.supabase.co",
      NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
    },
    { mode: GUARD_MODES.SEED },
  );
  assert.equal(verdict.ok, false);
  assert.ok(verdict.refusals.includes("supabase_url_loopback"));
  assert.ok(verdict.refusals.includes("no_known_hosted_or_production_host"));
});

test("P2-13 guard refuses hosts that only look local", () => {
  for (const host of [
    "http://localhost.evil.example:54321",
    "http://127.0.0.1.attacker.test:54321",
    "http://staging-db:54321",
    "http://not-localhost:54321",
  ]) {
    const verdict = classifyP2_13Target(
      { ...LOCAL_ENV, OPERATIONAL_FLOW_TEST_SUPABASE_URL: host, NEXT_PUBLIC_SUPABASE_URL: host },
      { mode: GUARD_MODES.SEED },
    );
    assert.equal(verdict.ok, false, `${host} must be refused`);
    assert.ok(verdict.refusals.includes("supabase_url_loopback"), `${host} must fail the loopback signal`);
  }
});

test("P2-13 guard refuses an unexpected local port", () => {
  const verdict = classifyP2_13Target(
    {
      ...LOCAL_ENV,
      OPERATIONAL_FLOW_TEST_SUPABASE_URL: "http://127.0.0.1:5432",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:5432",
    },
    { mode: GUARD_MODES.SEED },
  );
  assert.equal(verdict.ok, false);
  assert.ok(verdict.refusals.includes("supabase_url_expected_port"));
});

test("P2-13 guard never honours the remote-allow override", () => {
  const verdict = classifyP2_13Target(
    { ...LOCAL_ENV, OPERATIONAL_FLOW_TEST_ALLOW_REMOTE: "true" },
    { mode: GUARD_MODES.SEED },
  );
  assert.equal(verdict.ok, false);
  assert.ok(verdict.refusals.includes("remote_override_absent"));
});

test("P2-13 guard refuses when the app and the harness address different databases", () => {
  const verdict = classifyP2_13Target(
    { ...LOCAL_ENV, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54399" },
    { mode: GUARD_MODES.SEED },
  );
  assert.equal(verdict.ok, false);
  assert.ok(verdict.refusals.includes("app_and_harness_share_one_target"));
});

test("P2-13 guard requires a separate explicit opt-in before any destructive reset", () => {
  const seedOnly = { ...LOCAL_ENV, P2_13_ALLOW_LOCAL_RESET: "false" };
  assert.equal(classifyP2_13Target(seedOnly, { mode: GUARD_MODES.SEED }).ok, true);
  const destructive = classifyP2_13Target(seedOnly, { mode: GUARD_MODES.DESTRUCTIVE });
  assert.equal(destructive.ok, false);
  assert.ok(destructive.refusals.includes("explicit_local_reset_opt_in"));
});

test("P2-13 guard refuses a production NODE_ENV", () => {
  const verdict = classifyP2_13Target({ ...LOCAL_ENV, NODE_ENV: "production" }, { mode: GUARD_MODES.SEED });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.refusals.includes("node_env_not_production"));
});

test("P2-13 guard requires an environment-supplied fixture password", () => {
  const verdict = classifyP2_13Target({ ...LOCAL_ENV, P2_13_FIXTURE_ACTOR_PASSWORD: "short" }, { mode: GUARD_MODES.SEED });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.refusals.includes("fixture_actor_password_present"));
});

test("P2-13 guard reports only non-secret target details", () => {
  const verdict = classifyP2_13Target(LOCAL_ENV, { mode: GUARD_MODES.DESTRUCTIVE });
  const serialized = JSON.stringify(verdict);
  assert.ok(!serialized.includes("local-service-role"));
  assert.ok(!serialized.includes(LOCAL_ENV.P2_13_FIXTURE_ACTOR_PASSWORD));
  assert.ok(!serialized.includes("postgres:postgres"));
  assert.equal(verdict.target.databaseHost, `127.0.0.1:${EXPECTED_DATABASE_PORT}`);
});

test("assertIsolatedTarget throws a structured refusal", () => {
  assert.throws(
    () => assertIsolatedTarget({}, { mode: GUARD_MODES.SEED }),
    (error) => error.code === "P2_13_ISOLATION_REFUSED" && Array.isArray(error.verdict.refusals),
  );
});

// ── deterministic scenario manifest ───────────────────────────────────────

test("P2-13 scenario identities are deterministic and well-formed", () => {
  assert.match(P2_13_SCENARIO_ID, UUID);
  assert.equal(deterministicUuid("scenario"), P2_13_SCENARIO_ID);
  assert.notEqual(deterministicUuid("scenario"), deterministicUuid("other"));
  for (const id of [...SCENARIO_WORKSPACE_IDS, ...SCENARIO_PROJECT_IDS]) assert.match(id, UUID);
});

test("P2-13 seeds exactly two isolated tenants with distinct identities", () => {
  assert.equal(P2_13_TENANTS.length, 2);
  const [a, b] = P2_13_TENANTS;
  assert.equal(a.semanticRole, "founder_scenario_under_test");
  assert.equal(b.semanticRole, "isolation_negative_control");
  const ids = [a.workspaceId, b.workspaceId, a.projectId, b.projectId];
  assert.equal(new Set(ids).size, ids.length, "tenant identities must not collide");
  assert.notEqual(a.intake.sourceKey, b.intake.sourceKey);
  assert.notEqual(a.intake.correlationId, b.intake.correlationId);
  assert.notEqual(a.intake.rawIdempotencyKey, b.intake.rawIdempotencyKey);
});

test("P2-13 fixture actor emails are unique deterministic natural keys", () => {
  assert.equal(new Set(SCENARIO_ACTOR_EMAILS).size, SCENARIO_ACTOR_EMAILS.length);
  for (const email of SCENARIO_ACTOR_EMAILS) assert.match(email, /^p2-13-[0-9a-f]{8}-[ab]-[a-z]+@example\.test$/);
  assert.equal(actorFor("A", "viewer").role, "viewer");
  assert.equal(tenantByKey("B").actors.length, 1);
});

test("P2-13 carries no credential anywhere in the manifest", () => {
  const serialized = JSON.stringify({ tenants: P2_13_TENANTS, handoff: buildP2_14HandoffManifest() });
  for (const forbidden of ["password", "token", "secret", "apiKey", "serviceRole", "session"]) {
    assert.ok(!new RegExp(forbidden, "i").test(serialized), `manifest must not mention ${forbidden}`);
  }
});

test("P2-13 preseeds context only, leaving every P2-14 transition to P2-14", () => {
  assert.deepEqual(
    Object.entries(CANONICAL_SPINE_OWNERSHIP).filter(([, owner]) => owner === "PRESEEDED").map(([node]) => node),
    ["source", "rawInput", "normalizedEvent", "evidence", "finding", "recommendation"],
  );
  for (const node of ["decision", "materialAction", "task", "internalExecution", "outcome", "observation"]) {
    assert.equal(CANONICAL_SPINE_OWNERSHIP[node], "P2-14 CREATED", `${node} must not be preseeded`);
  }
});

test("P2-13 fixture labelling uses the canonical schema representation", () => {
  assert.equal(FIXTURE_LABEL, "DEMO / FIXTURE");
  assert.equal(FIXTURE_EVIDENCE_STATE, "DEMO_FIXTURE");
  assert.equal(FIXTURE_EXPIRY_OWNER, "P2-14");

  // The label and evidence classification must be exactly what the verified
  // migrations already enforce, not a parallel invention.
  const intake = readFileSync("supabase/migrations/20260901000000_raw_input_normalized_event_foundation.sql", "utf8");
  const provenance = readFileSync("supabase/migrations/20260902000000_evidence_derivation_provenance.sql", "utf8");
  assert.ok(intake.includes(`fixture_label = '${FIXTURE_LABEL}'`));
  assert.ok(provenance.includes(`fixture_state in ('LIVE','${FIXTURE_EVIDENCE_STATE}')`));
});

test("P2-13 expected chain counts match the deterministic detector rules", () => {
  // Both fixture payloads must match exactly the scope_creep and
  // missing_approval rules — no more — or the expected counts are a guess.
  const migration = readFileSync("supabase/migrations/20260611000000_operational_evidence_decision_loop.sql", "utf8");
  const patterns = [...migration.matchAll(/\('([a-z_]+)','(?:high|medium)',\d+::numeric,'[^']*','([^']*)'\)/g)].map(
    ([, signalType, pattern]) => ({ signalType, regex: new RegExp(pattern, "i") }),
  );
  assert.ok(patterns.length >= 10, "detector rules must be readable from the verified migration");

  for (const tenant of P2_13_TENANTS) {
    const corpus = `${tenant.intake.title}\n${tenant.intake.content}`;
    const matched = patterns.filter((rule) => rule.regex.test(corpus)).map((rule) => rule.signalType);
    assert.deepEqual(
      matched.sort(),
      ["missing_approval", "scope_creep"],
      `tenant ${tenant.key} must match exactly the two expected rules, got ${matched.join(",")}`,
    );
    assert.equal(matched.length, EXPECTED_CHAIN_COUNTS.signals);
  }
});

test("P2-13 handoff manifest is structured, credential-free and names its expiry owner", () => {
  const handoff = buildP2_14HandoffManifest();
  assert.equal(handoff.founderScenarioId, P2_13_SCENARIO_ID);
  assert.equal(handoff.fixtureExpiryOwner, "P2-14");
  assert.equal(handoff.tenants.length, 2);
  assert.equal(handoff.expectedNegativeControl.tenant, "B");
  assert.ok(handoff.expectedP2_14Transitions.length >= 6);
  for (const key of ["preflight", "seed", "verify", "reset", "reseed", "runtimeAcceptance"]) {
    assert.ok(handoff.commands[key], `handoff must publish the ${key} command`);
  }
});

// ── fixture-scoped cleanup ────────────────────────────────────────────────

test("P2-13 cleanup order deletes every child before its restricted parent", () => {
  const position = new Map(FIXTURE_CLEANUP_PLAN.map((step, index) => [step.table, index]));
  // Each pair is a RESTRICT / NO ACTION edge read from the live schema graph.
  const edges = [
    ["canonical_outcome_observations", "canonical_task_outcomes"],
    ["canonical_outcome_observations", "execution_tasks"],
    ["canonical_task_outcomes", "execution_tasks"],
    ["internal_task_executions", "execution_tasks"],
    ["internal_task_executions", "material_action_proposals"],
    ["internal_task_executions", "material_action_governance_evaluations"],
    ["material_action_audit_events", "material_action_proposals"],
    ["material_action_governance_evaluations", "material_action_proposals"],
    ["material_action_proposals", "operational_decision_records"],
    ["execution_task_events", "execution_tasks"],
    ["execution_tasks", "recommended_actions"],
    ["decision_evidence_links", "operational_decision_records"],
    ["decision_evidence_links", "evidence_items"],
    ["operational_decision_records", "recommended_actions"],
    ["operational_decision_records", "governance_events"],
    ["recommended_actions", "governance_events"],
    ["recommended_actions", "risk_issue_records"],
    ["governance_events", "risk_issue_records"],
    ["risk_issue_records", "operational_signals"],
    ["operational_signals", "evidence_items"],
    ["agent_outputs", "agent_runs"],
    ["evidence_items", "operational_normalized_events"],
    ["evidence_items", "operational_raw_inputs"],
    ["evidence_items", "operational_sources"],
    ["operational_normalized_events", "operational_raw_inputs"],
    ["operational_normalized_events", "operational_sources"],
    ["operational_raw_inputs", "operational_sources"],
    ["platform_events", "projects"],
    ["internal_task_executions", "projects"],
    ["material_action_audit_events", "workspaces"],
    ["projects", "workspaces"],
    ["workspace_memberships", "workspaces"],
    ["trial_licenses", "early_access_invites"],
    ["workspace_activations", "early_access_invites"],
    ["early_access_events", "early_access_invites"],
    ["early_access_invites", "workspaces"],
  ];
  for (const [child, parent] of edges) {
    assert.ok(position.has(child), `${child} must be in the cleanup plan`);
    assert.ok(position.has(parent), `${parent} must be in the cleanup plan`);
    assert.ok(
      position.get(child) < position.get(parent),
      `${child} must be deleted before ${parent}`,
    );
  }
});

test("P2-13 reset never truncates, drops or globally disables enforcement", () => {
  const sql = buildResetSql({
    workspaceIds: [...SCENARIO_WORKSPACE_IDS],
    projectIds: [...SCENARIO_PROJECT_IDS],
    inviteIds: P2_13_TENANTS.map((tenant) => tenant.founderInvite.inviteId),
    actorEmails: [...SCENARIO_ACTOR_EMAILS],
  });
  assert.ok(!/\btruncate\b/i.test(sql));
  assert.ok(!/\bdrop\s+(schema|table|database)\b/i.test(sql));
  assert.ok(!/disable\s+row\s+level\s+security/i.test(sql));
  assert.ok(!/session_replication_role/i.test(sql));
  assert.ok(!/disable\s+trigger\s+all/i.test(sql));
  assert.ok(!/alter\s+table[^\n]*drop\s+constraint/i.test(sql));

  // Every deletion is scoped; a bare `delete from public.x;` would be a bug.
  const deletes = [...sql.matchAll(/delete from public\.(\w+)([^\n]*)/g)];
  assert.equal(deletes.length, FIXTURE_CLEANUP_PLAN.length);
  for (const [, table, tail] of deletes) {
    assert.match(tail, /\bwhere\b/, `delete from ${table} must be scoped`);
  }
});

test("P2-13 reset re-enables every immutability trigger it disables", () => {
  const sql = buildResetSql({
    workspaceIds: [...SCENARIO_WORKSPACE_IDS],
    projectIds: [...SCENARIO_PROJECT_IDS],
    inviteIds: P2_13_TENANTS.map((tenant) => tenant.founderInvite.inviteId),
    actorEmails: [...SCENARIO_ACTOR_EMAILS],
  });
  assert.ok(UNEXEMPTED_IMMUTABILITY_TRIGGERS.length > 0);
  for (const [table, trigger] of UNEXEMPTED_IMMUTABILITY_TRIGGERS) {
    assert.ok(sql.includes(`alter table public.${table} disable trigger ${trigger};`));
    assert.ok(sql.includes(`alter table public.${table} enable trigger ${trigger};`));
    assert.ok(
      sql.indexOf(`disable trigger ${trigger};`) < sql.indexOf(`enable trigger ${trigger};`),
      `${trigger} must be re-enabled after it is disabled`,
    );
  }
  // One transaction, so a failure rolls the trigger state back with it.
  assert.equal((sql.match(/^begin;$/gm) ?? []).length, 1);
  assert.equal((sql.match(/^commit;$/gm) ?? []).length, 1);
});

test("P2-13 reset refuses to build SQL from a non-deterministic identity", () => {
  const base = {
    workspaceIds: [...SCENARIO_WORKSPACE_IDS],
    projectIds: [...SCENARIO_PROJECT_IDS],
    inviteIds: [],
    actorEmails: [],
  };
  assert.throws(
    () => buildResetSql({ ...base, workspaceIds: ["'; drop table public.workspaces; --"] }),
    /p2_13_reset_invalid_workspace_id/,
  );
  assert.throws(
    () => buildResetSql({ ...base, actorEmails: ["not-an-email"] }),
    /p2_13_reset_invalid_actor_email/,
  );
  // An empty scope must still produce typed SQL rather than an untyped array.
  assert.ok(buildResetSql(base).includes("array[]::uuid[]"));
});

test("P2-13 SQL runner fails closed when no local database is reachable", () => {
  // No executor may be minted at all unless the guard has already classified
  // this exact env as LOCAL_ISOLATED under the destructive opt-ins. This is
  // enforced inside resolveSqlRunner, so a future caller that forgets to
  // guard first cannot obtain a SQL capability.
  const unguarded = resolveSqlRunner({}, { run: () => ({ status: 0 }) });
  assert.equal(unguarded.ok, false);
  assert.match(unguarded.reason, /not proven LOCAL_ISOLATED/);
  assert.ok(unguarded.refusals.includes("explicit_p2_13_opt_in"));

  const remoteTarget = resolveSqlRunner(
    {
      ...LOCAL_ENV,
      OPERATIONAL_FLOW_TEST_DATABASE_URL: "postgresql://postgres:postgres@db.project-ref.supabase.co:5432/postgres",
    },
    { run: () => ({ status: 0 }) },
  );
  assert.equal(remoteTarget.ok, false, "a hosted database URL must never yield an executor");
  assert.ok(remoteTarget.refusals.includes("database_url_loopback"));

  const withoutResetOptIn = resolveSqlRunner(
    { ...LOCAL_ENV, P2_13_ALLOW_LOCAL_RESET: "false" },
    { run: () => ({ status: 0 }) },
  );
  assert.equal(withoutResetOptIn.ok, false, "the destructive opt-in is required to mint an executor");

  const missingDatabaseUrl = resolveSqlRunner(
    { ...LOCAL_ENV, OPERATIONAL_FLOW_TEST_DATABASE_URL: "" },
    { run: () => ({ status: 0 }) },
  );
  assert.equal(missingDatabaseUrl.ok, false);

  const ambiguous = resolveSqlRunner(LOCAL_ENV, {
    run: (cmd) =>
      cmd === "psql"
        ? { status: 1 }
        : { status: 0, stdout: "supabase_db_one\nsupabase_db_two\n" },
  });
  assert.equal(ambiguous.ok, false, "two candidate local stacks must be refused, not guessed between");

  const resolved = resolveSqlRunner(LOCAL_ENV, { run: () => ({ status: 0 }) });
  assert.equal(resolved.ok, true, "a fully proven local target does resolve an executor");
  assert.equal(resolved.kind, "psql");
});

test("P2-13 reset states its privilege honestly rather than claiming RLS enforcement", () => {
  const source = readFileSync("scripts/p2-13/fixture-cleanup.mjs", "utf8");
  // The maintenance role holds rolbypassrls. Claiming "RLS enforced
  // throughout" here would be false, so the module must say the opposite.
  assert.match(source, /rolbypassrls/);
  assert.match(source, /RLS is NOT enforced against this maintenance connection/);
  assert.ok(
    !/RLS (remains?|is) fully enforced/i.test(source),
    "the cleanup module must not claim RLS constrains the maintenance actor",
  );
});

test("P2-13 reset counts are parsed from the transaction output", () => {
  assert.deepEqual(
    parseResetCounts('BEGIN\nnoise\n[{"table":"workspaces","deleted":2}]\nCOMMIT\n'),
    [{ table: "workspaces", deleted: 2 }],
  );
  assert.equal(parseResetCounts("no json here"), null);
});

// ── observability: secrets and honest stage accounting ────────────────────

test("P2-13 redaction removes bound secrets and credential shapes", () => {
  const redact = createSecretRedactor(["a-very-secret-service-role-key"]);
  const output = redact({
    key: "a-very-secret-service-role-key",
    jwt: "eyJhbGciOi.eyJzdWIiOiIx.SflKxwRJSMeKK",
    supabase: "sb_secret_abcdefgh12345678",
    db: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    nested: [{ token: "sbp_0123456789abcdefgh" }],
    safe: "workspace 060659c6-40a3-56d0-982d-80e5fd15ad74",
  });
  const serialized = JSON.stringify(output);
  for (const secret of [
    "a-very-secret-service-role-key",
    "eyJhbGciOi.eyJzdWIiOiIx",
    "sb_secret_abcdefgh",
    "postgres:postgres@",
    "sbp_0123456789",
  ]) {
    assert.ok(!serialized.includes(secret), `${secret} must be redacted`);
  }
  assert.ok(serialized.includes("060659c6-40a3-56d0-982d-80e5fd15ad74"), "non-secret ids must survive");
});

test("P2-13 redaction survives a circular report without leaking", () => {
  const redact = createSecretRedactor(["another-secret-value-here"]);
  const report = { key: "another-secret-value-here" };
  report.self = report;
  const output = redact(report);
  assert.equal(output.key, "[REDACTED]");
  assert.equal(output.self, "[CIRCULAR]");
});

test("P2-13 failure reasons keep the signal but drop provider internals", () => {
  const redact = createSecretRedactor(["postgresql://postgres:postgres@127.0.0.1:54322/postgres"]);
  const reason = safeFailureReason(
    { message: "", code: "42703", details: "column does not exist" },
    redact,
  );
  assert.match(reason, /42703/);
  assert.match(reason, /column does not exist/);

  const multiline = safeFailureReason(new Error("boom\n  at stack frame\n  at another"), redact);
  assert.equal(multiline, "boom", "a stack must never ride along in the printed reason");

  assert.equal(
    safeFailureReason("connect postgresql://postgres:postgres@127.0.0.1:54322/postgres", redact),
    "connect [REDACTED]",
  );
});

test("P2-13 stage tracking reports PARTIAL_SEED unless every stage completed", () => {
  const stages = ["one", "two", "three"];

  const full = createStageTracker(stages);
  stages.forEach((stage) => full.complete(stage));
  assert.equal(full.snapshot().status, RUN_STATUS.COMPLETE);

  const failed = createStageTracker(stages);
  failed.complete("one");
  failed.fail("two", "boom");
  const snapshot = failed.snapshot();
  assert.equal(snapshot.status, RUN_STATUS.PARTIAL_SEED);
  assert.deepEqual(snapshot.completedStages, ["one"]);
  assert.deepEqual(snapshot.failedStages, [{ name: "two", detail: "boom" }]);
  assert.deepEqual(snapshot.unreachedStages, ["three"], "stages never reached must be reported, not hidden");

  // An interrupted run leaves a stage `running`; that is not success.
  const interrupted = createStageTracker(stages);
  interrupted.complete("one");
  interrupted.begin("two");
  assert.equal(interrupted.snapshot().status, RUN_STATUS.PARTIAL_SEED);

  assert.throws(() => createStageTracker(stages).complete("missing"), /p2_13_unknown_stage/);
});

// ── harness shape (supplement only) ───────────────────────────────────────

test("P2-13 harness never inserts Evidence directly or fabricates a digest", () => {
  const HARNESS_SOURCES = [
    "scripts/p2-13-founder-scenario.mjs",
    "scripts/p2-13/founder-scenario-manifest.mjs",
    "scripts/p2-13/isolation-guard.mjs",
    "scripts/p2-13/fixture-cleanup.mjs",
    "scripts/p2-13/observability.mjs",
  ];

  for (const path of [...HARNESS_SOURCES, "scripts/check-p2-13-db.mjs"]) {
    const source = readFileSync(path, "utf8");
    assert.ok(!/"0"\.repeat\(64\)/.test(source), `${path} must never fabricate a zero hash`);
    assert.ok(!/allowDecisionWriteback\s*[:=]\s*true/.test(source), `${path} must never enable remote writeback`);
  }

  for (const path of HARNESS_SOURCES) {
    assert.ok(
      !/from\(\s*["']evidence_items["']\s*\)\s*\.\s*insert/.test(readFileSync(path, "utf8")),
      `${path} must never insert Evidence directly`,
    );
  }

  // The acceptance runner is the one place that *does* attempt a direct
  // Evidence insert — as a negative probe that must be denied. Asserting it
  // is present keeps that proof from being quietly dropped.
  const acceptance = readFileSync("scripts/check-p2-13-db.mjs", "utf8");
  assert.match(acceptance, /from\("evidence_items"\)\.insert/);
  assert.match(acceptance, /a direct Evidence insert by an authenticated actor is denied/);
});

test("P2-13 seeds the canonical spine through the verified derivation RPCs", () => {
  const source = readFileSync("scripts/p2-13-founder-scenario.mjs", "utf8");
  for (const rpc of [
    "capture_operational_input",
    "derive_operational_evidence",
    "materialize_operational_chain",
  ]) {
    assert.ok(source.includes(`rpc("${rpc}"`), `the seed must call the verified ${rpc} contract`);
  }
  // The transitions P2-14 owns must not appear as seed calls.
  for (const rpc of [
    "persist_governed_material_action",
    "dispatch_governed_action_to_internal_task",
    "ensure_expected_task_outcome",
    "record_canonical_outcome_observation",
    "record_operational_decision",
  ]) {
    assert.ok(!source.includes(`rpc("${rpc}"`), `the seed must not perform the ${rpc} transition P2-14 owns`);
  }
});

test("P2-13 re-materializes the Finding chain only when a branch is missing", () => {
  const source = readFileSync("scripts/p2-13-founder-scenario.mjs", "utf8");

  // `materialize_operational_chain` is idempotent for every canonical node it
  // creates, but appends an `agent_runs` + `agent_outputs` detector run on
  // every invocation. A blind replay would therefore duplicate that run. The
  // harness must decide before calling, and must decide on the whole fan-out
  // rather than on signals alone, so a partially damaged chain still repairs.
  assert.match(source, /async function chainIsComplete|function chainIsComplete/);
  assert.match(source, /const before = await readChainState\(/);
  assert.match(source, /if \(chainIsComplete\(before\)\) \{\s*\n\s*return \{ disposition: "already_materialized"/);

  const guard = source.slice(source.indexOf("function chainIsComplete"));
  for (const branch of ["signals", "riskIssueRecords", "governanceEvents", "recommendations"]) {
    assert.ok(
      guard.slice(0, 600).includes(`state.${branch} === EXPECTED_CHAIN_COUNTS.${branch}`),
      `completeness must cover the ${branch} branch, not signals alone`,
    );
  }

  // The fix belongs in the harness, not in the verified P2-06 contract:
  // appending a run record per real detector execution is correct behaviour,
  // and P2-13 must not weaken a verified contract to tidy its own replay.
  assert.ok(
    !/create or replace function|alters+tables+public./i.test(source),
    "P2-13 must not redefine a verified database contract",
  );
});

test("P2-13 verify reports detector runs and asserts correlation continuity", () => {
  const source = readFileSync("scripts/p2-13-founder-scenario.mjs", "utf8");

  // Counted so a duplicated replay is observable, but never pinned to 1 —
  // a genuine repair is a real second detector execution and must not be
  // reported as a damaged scenario.
  assert.match(source, /nodes\.detectorRuns = await exactCount\(admin, "agent_runs"/);
  assert.ok(
    !/problems\.push\(`detector_runs/.test(source),
    "a repair replay must not be reported as a damaged scenario",
  );

  // One correlation id must run unbroken across Raw Input, Normalized Event
  // and Evidence so P2-14 can join the whole lineage on it.
  const correlationChecks = source.match(/\["correlation_mismatch",/g) ?? [];
  assert.equal(correlationChecks.length, 3, "correlation continuity is asserted at all three canonical nodes");

  // Causation must be the real parent node, never an invented value.
  assert.match(source, /\["causation_is_raw_input", normalizedEvent\?\.causation_id === nodes\.rawInput\]/);
  assert.match(source, /p_causation_id: null/);
});

test("P2-13 resolves fixture identities without depending on the fixture password", () => {
  const source = readFileSync("scripts/p2-13-founder-scenario.mjs", "utf8");

  // A rotated P2_13_FIXTURE_ACTOR_PASSWORD must not strand a scenario. If
  // identity resolution went through signInWithPassword, an existing scenario
  // would become both unseedable and unresettable, and reset would report
  // success while leaving orphan fixture accounts behind.
  assert.match(source, /async function findFixtureUserByEmail\(email\)/);
  assert.match(source, /admin\.auth\.admin\.listUsers\(/);

  // The lookup may only ever match an email this scenario owns.
  const lookup = source.slice(
    source.indexOf("async function findFixtureUserByEmail"),
    source.indexOf("Resolve a deterministic fixture actor"),
  );
  assert.match(lookup, /SCENARIO_ACTOR_EMAILS/);
  assert.match(lookup, /p2_13_unowned_actor_email/);

  // Reset resolves ids by admin lookup, never by signing in.
  const reset = source.slice(source.indexOf("async function runReset"));
  assert.match(reset, /const existing = await findFixtureUserByEmail\(email\)/);
  assert.ok(
    !/signInWithPassword/.test(reset.slice(0, reset.indexOf("const before = await residueCounts"))),
    "reset must not resolve fixture identities by password sign-in",
  );

  // An existing account CAN be realigned to the environment-supplied password
  // rather than left unusable — but only behind its own explicit opt-in.
  assert.match(source, /admin\.auth\.admin\.updateUserById\(existing\.id, \{/);
  assert.match(source, /fixture_actor_realign/);
  assert.match(source, /env\.P2_13_REALIGN_FIXTURE_ACTORS !== "true"/);

  // Without the opt-in a mismatched password must FAIL, not repair itself:
  // otherwise a typo rewrites working credentials, and a seed that genuinely
  // cannot authenticate reports success instead of PARTIAL_SEED.
  const gate = source.indexOf('env.P2_13_REALIGN_FIXTURE_ACTORS !== "true"');
  const write = source.indexOf("admin.auth.admin.updateUserById");
  assert.ok(gate > 0 && gate < write, "the opt-in gate precedes the credential write");
  assert.match(source, /the deterministic fixture identity exists but its password does not match/);
});

test("P2-13 verify never provisions or realigns an identity", () => {
  const source = readFileSync("scripts/p2-13-founder-scenario.mjs", "utf8");

  // `create: false` must short-circuit before any admin write, so a verify of
  // a reset scenario reports ABSENT instead of resurrecting the fixtures.
  assert.match(source, /if \(signIn\.error && !create\) return null;/);
  const guardIndex = source.indexOf("if (signIn.error && !create) return null;");
  const realignIndex = source.indexOf("admin.auth.admin.updateUserById");
  assert.ok(guardIndex > 0 && guardIndex < realignIndex, "the read-only guard precedes every admin write");
  assert.match(source, /const actorsById = await authenticateAllActors\(\{ create: false \}\);/);
});
