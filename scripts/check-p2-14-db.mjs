#!/usr/bin/env node
/**
 * P2-14 review-repair runtime gate — DEMO / LIVE Source classification.
 *
 * The P2-14 independent review reproduced a provenance-integrity defect in BOTH
 * directions, and neither was reachable through source reading alone: each depended on
 * which Source row a capture contract resolved at runtime on a project where the reserved
 * key did not yet exist. This gate proves the repair against a real database.
 *
 *   PROMOTION.  Live intake against the reserved DEMO key minted a NON-fixture Source
 *   under `manual-demo:v1`. Every later demo capture reused it, and `fixture_state` came
 *   out `LIVE` for demo material — Observation-eligible under P2-09.
 *
 *   DENIAL OF SERVICE.  The mirror. Demo intake against the reserved LIVE key minted a
 *   FIXTURE Source under `live-observation:v1`, and genuine live intake was refused from
 *   then on. `operational_sources` has no application repair path.
 *
 * Both are proven refused here at BOTH layers — the HTTP product boundary that now pins
 * the Source key, and the database contract that independently refuses a Source whose
 * persisted classification does not match the lineage writing to it.
 *
 * Sequence:
 *   precheck -> reserved-identity inspection (READ ONLY) -> fresh tenant
 *   -> A: promotion prevention -> B: DoS prevention -> C: persisted mismatch refusal
 *   -> retry/idempotency -> summary
 *
 * NEVER run this against anything but an isolated, disposable local stack. The loopback
 * guard refuses any other target before a client is built.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const supabaseUrl = process.env.OPERATIONAL_FLOW_TEST_SUPABASE_URL;
const anonKey = process.env.OPERATIONAL_FLOW_TEST_ANON_KEY;
const serviceRoleKey = process.env.OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY;
const appBaseUrl = process.env.OPERATIONAL_FLOW_TEST_BASE_URL?.replace(/\/$/, "");

if (
  !supabaseUrl ||
  !anonKey ||
  !serviceRoleKey ||
  !appBaseUrl ||
  process.env.OPERATIONAL_FLOW_TEST_ALLOW_DESTRUCTIVE !== "true"
) {
  console.error(
    [
      "P2-14 live verification requires the disposable local PMFreak stack.",
      "Set OPERATIONAL_FLOW_TEST_SUPABASE_URL, OPERATIONAL_FLOW_TEST_ANON_KEY,",
      "OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY, OPERATIONAL_FLOW_TEST_BASE_URL",
      "and OPERATIONAL_FLOW_TEST_ALLOW_DESTRUCTIVE=true.",
    ].join("\n"),
  );
  process.exit(2);
}

for (const [name, target] of [
  ["Supabase API", supabaseUrl],
  ["PMFreak", appBaseUrl],
]) {
  let host;
  try {
    host = new URL(target).hostname;
  } catch {
    console.error(`SAFETY ABORT: invalid ${name} URL.`);
    process.exit(2);
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
    console.error(`SAFETY ABORT: ${name} must use a literal loopback host.`);
    process.exit(2);
  }
}

if (appBaseUrl !== "http://localhost:3000") {
  console.error("SAFETY ABORT: browser/runtime origin must be http://localhost:3000.");
  process.exit(2);
}

/** The two reserved built-in identities, mirrored from src/lib/operational-flow/intake-source-keys.ts. */
const DEMO_KEY = "manual-demo:v1";
const LIVE_KEY = "live-observation:v1";

const { createClient } = await import("@supabase/supabase-js");

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(supabaseUrl, serviceRoleKey, clientOptions);
const makeClient = () => createClient(supabaseUrl, anonKey, clientOptions);

const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const password = `P2-14-${randomUUID()}!`;

let assertions = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  assertions += 1;
  console.log(`  PASS  ${message}`);
};
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  assertions += 1;
  console.log(`  PASS  ${message}`);
};

/** The RPC error code, without the driver prefix the service layer adds. */
const rpcCode = (result) => String(result.error?.message ?? "").trim();

async function createUser(label) {
  const email = `p2-14-${label}-${suffix}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  const client = makeClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);
  return { id: created.data.user.id, email, client };
}

async function authCookie(user) {
  const form = new FormData();
  form.set("email", user.email);
  form.set("password", password);
  form.set("next", "/projects");
  const response = await fetch(`${appBaseUrl}/api/login`, { method: "POST", body: form, redirect: "manual" });
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  assert.ok(values.length > 0, "authenticated login returns cookies");
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function api(cookie, body) {
  const response = await fetch(`${appBaseUrl}/api/operational-flow`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

async function summary(cookie, workspaceId, projectId) {
  const url = `${appBaseUrl}/api/operational-flow?workspaceId=${workspaceId}&projectId=${projectId}`;
  const response = await fetch(url, { headers: { cookie }, cache: "no-store" });
  assert.equal(response.status, 200, "summary readable");
  return response.json();
}

async function captureLiveRpc(client, workspaceId, projectId, sourceKey, overrides = {}) {
  return client.rpc("capture_live_operational_input", {
    p_workspace_id: workspaceId,
    p_project_id: projectId,
    p_source_key: sourceKey,
    p_idempotency_key: overrides.idempotencyKey ?? `live-rpc-${randomUUID()}`,
    p_title: overrides.title ?? "LIVE probe",
    p_content: overrides.content ?? "Live operational record captured for the P2-14 classification gate.",
    p_occurred_at: overrides.occurredAt ?? new Date().toISOString(),
    p_correlation_id: overrides.correlationId ?? randomUUID(),
    p_causation_id: null,
    p_external_id: null,
  });
}

async function captureDemoRpc(client, workspaceId, projectId, sourceKey, overrides = {}) {
  return client.rpc("capture_operational_input", {
    p_workspace_id: workspaceId,
    p_project_id: projectId,
    p_source_key: sourceKey,
    p_idempotency_key: overrides.idempotencyKey ?? `demo-rpc-${randomUUID()}`,
    p_title: overrides.title ?? "DEMO probe",
    p_content: overrides.content ?? "Demonstration material captured for the P2-14 classification gate.",
    p_occurred_at: overrides.occurredAt ?? new Date().toISOString(),
    p_correlation_id: overrides.correlationId ?? randomUUID(),
    p_causation_id: null,
    p_external_id: null,
  });
}

async function sourceRow(workspaceId, projectId, sourceKey) {
  const result = await admin
    .from("operational_sources")
    .select("id,source_key,source_kind,is_fixture,status")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .eq("source_key", sourceKey)
    .maybeSingle();
  assert.ifError(result.error);
  return result.data ?? null;
}

// ───────────────────────────── reserved-identity inspection ─────────────────────────────
//
// READ ONLY, and deliberately so. A mismatched reserved row is REPORTED, never repaired:
// relabelling a Source that already has Raw Input, Normalized Events and Evidence hanging
// off it would rewrite the provenance of everything derived from it. The authorized route
// back to a clean state is the P2-13 reseed harness, not an ad-hoc UPDATE.

console.log("\n── Reserved intake identities across all existing projects (read only) ──");

const reservedRows = await admin
  .from("operational_sources")
  .select("id,workspace_id,project_id,source_key,source_kind,is_fixture,status")
  .in("source_key", [DEMO_KEY, LIVE_KEY]);
assert.ifError(reservedRows.error);

const mismatched = [];
for (const row of reservedRows.data ?? []) {
  const expected = row.source_key === DEMO_KEY;
  const label = row.source_key === DEMO_KEY ? "DEMO_KEY_SOURCE" : "LIVE_KEY_SOURCE";
  const verdict = row.is_fixture === expected ? "OK" : "MISMATCH";
  console.log(
    `  ${label}: ${row.id} / is_fixture=${row.is_fixture} / kind=${row.source_kind} ` +
      `/ project=${row.project_id} -> ${verdict}`,
  );
  if (verdict === "MISMATCH") mismatched.push(row);
}
if ((reservedRows.data ?? []).length === 0) {
  console.log("  DEMO_KEY_SOURCE: none");
  console.log("  LIVE_KEY_SOURCE: none");
}

if (mismatched.length > 0) {
  console.error(
    [
      "",
      `STOP: ${mismatched.length} reserved Source row(s) carry the wrong classification.`,
      "This gate does NOT repair them. A mismatched reserved identity means demo and live",
      "provenance have already been mixed on that project, and the classification of a",
      "Source with derived Evidence is not this script's to rewrite.",
      "Restore a clean deterministic baseline through the authorized P2-13 reseed harness",
      "(npm run seed:p2-13-founder), then re-run.",
    ].join("\n"),
  );
  process.exit(3);
}
console.log("  No mismatched reserved identity found.");

// ───────────────────────────── fresh tenant ─────────────────────────────
//
// Fresh on purpose: both collisions were only reachable where the reserved key did not yet
// exist, because that is the branch where each contract MINTS the Source.

const workspaceId = randomUUID();
const projectId = randomUUID();
const owner = await createUser("owner");

const workspace = await admin.from("workspaces").insert({
  id: workspaceId,
  name: `P2-14 workspace ${suffix}`,
  created_by_user_id: owner.id,
});
assert.ifError(workspace.error);

const project = await admin.from("projects").insert({
  id: projectId,
  workspace_id: workspaceId,
  user_id: owner.id,
  name: `P2-14 project ${suffix}`,
});
assert.ifError(project.error);

const membership = await admin.from("workspace_memberships").insert({
  workspace_id: workspaceId,
  user_id: owner.id,
  role: "owner",
});
assert.ifError(membership.error);

const cookie = await authCookie(owner);

check(
  (await sourceRow(workspaceId, projectId, DEMO_KEY)) === null &&
    (await sourceRow(workspaceId, projectId, LIVE_KEY)) === null,
  "fresh project holds neither reserved Source identity",
);

// ───────────────────────────── A: promotion prevention ─────────────────────────────

console.log("\n── A: LIVE intake cannot claim the reserved DEMO identity ──");

const promotionHttp = await api(cookie, {
  operation: "capture_live_input",
  workspaceId,
  projectId,
  sourceKey: DEMO_KEY,
  idempotencyKey: `promotion-http-${suffix}`,
  title: "attempted promotion",
  content: "Live intake naming the reserved DEMO identity.",
  occurredAt: new Date().toISOString(),
  correlationId: randomUUID(),
});
equal(promotionHttp.status, 400, "HTTP: live intake naming the DEMO key is refused 400");
equal(
  promotionHttp.body.error,
  "intake_source_key_not_permitted",
  "HTTP: refusal names the pinned-source-key contract, not a coerced success",
);

const promotionRpc = await captureLiveRpc(owner.client, workspaceId, projectId, DEMO_KEY);
check(promotionRpc.error !== null, "RPC: live intake naming the DEMO key is refused");
equal(
  rpcCode(promotionRpc),
  "intake_source_key_reserved",
  "RPC: refusal is the reserved-identity guard, independent of the HTTP layer",
);

check(
  (await sourceRow(workspaceId, projectId, DEMO_KEY)) === null,
  "no Source was minted under the DEMO key by the refused attempts",
);

// The legitimate DEMO lineage still works, and stays fixture.
const demoCorrelation = randomUUID();
const demoCaptured = await api(cookie, {
  operation: "capture_input",
  workspaceId,
  projectId,
  idempotencyKey: `demo-capture-${suffix}`,
  title: "DEMO / FIXTURE material",
  content: "Demonstration input recorded through the ordinary product path.",
  occurredAt: new Date().toISOString(),
  correlationId: demoCorrelation,
});
equal(demoCaptured.status, 201, "legitimate DEMO capture succeeds");

const demoSource = await sourceRow(workspaceId, projectId, DEMO_KEY);
check(demoSource !== null, "DEMO capture resolved the server-pinned DEMO identity");
equal(demoSource.is_fixture, true, "DEMO Source is a fixture");

const demoEvidence = await api(cookie, {
  operation: "derive_evidence",
  workspaceId,
  projectId,
  normalizedEventId: demoCaptured.body.normalizedEvent.id,
  idempotencyKey: `demo-evidence-${suffix}`,
  assertionType: "ASSUMPTION",
  classification: "UNCLASSIFIED",
  confidenceScore: 0.5,
  missingDataState: "UNKNOWN",
  evaluatedAt: new Date().toISOString(),
});
equal(demoEvidence.status, 201, "DEMO Evidence derives");
equal(
  String(demoEvidence.body.evidence.fixture_state),
  "DEMO_FIXTURE",
  "DEMO Evidence is DEMO_FIXTURE — not promoted",
);

const afterDemo = await summary(cookie, workspaceId, projectId);
check(
  !(afterDemo.observationEligibleEvidence ?? []).some(
    (row) => String(row.id) === String(demoEvidence.body.evidence.id),
  ),
  "DEMO Evidence is NOT Observation-eligible",
);

// ───────────────────────────── B: denial-of-service prevention ─────────────────────────────

console.log("\n── B: DEMO intake cannot claim the reserved LIVE identity ──");

const dosHttp = await api(cookie, {
  operation: "capture_input",
  workspaceId,
  projectId,
  sourceKey: LIVE_KEY,
  idempotencyKey: `dos-http-${suffix}`,
  title: "attempted lockout",
  content: "Demo intake naming the reserved LIVE identity.",
  occurredAt: new Date().toISOString(),
  correlationId: randomUUID(),
});
equal(dosHttp.status, 400, "HTTP: demo intake naming the LIVE key is refused 400");
equal(
  dosHttp.body.error,
  "intake_source_key_not_permitted",
  "HTTP: refusal names the pinned-source-key contract",
);

const dosRpc = await captureDemoRpc(owner.client, workspaceId, projectId, LIVE_KEY);
check(dosRpc.error !== null, "RPC: demo intake naming the LIVE key is refused");
equal(
  rpcCode(dosRpc),
  "intake_source_key_reserved",
  "RPC: refusal is the reserved-identity guard, independent of the HTTP layer",
);

check(
  (await sourceRow(workspaceId, projectId, LIVE_KEY)) === null,
  "no Source was minted under the LIVE key by the refused attempts",
);

// Genuine LIVE intake still works end to end, and remains Observation-eligible.
const liveCaptured = await api(cookie, {
  operation: "capture_live_input",
  workspaceId,
  projectId,
  idempotencyKey: `live-capture-${suffix}`,
  title: "LIVE operational record",
  content: "Supplier confirmed the governed milestone in writing on the agreed date.",
  occurredAt: new Date().toISOString(),
  correlationId: randomUUID(),
});
equal(liveCaptured.status, 201, "legitimate LIVE capture succeeds");

const liveSource = await sourceRow(workspaceId, projectId, LIVE_KEY);
check(liveSource !== null, "LIVE capture resolved the server-pinned LIVE identity");
equal(liveSource.is_fixture, false, "LIVE Source is NOT a fixture");
check(Boolean(liveCaptured.body.rawInput?.id), "Raw Input created");
check(Boolean(liveCaptured.body.normalizedEvent?.id), "Normalized Event created");
equal(liveCaptured.body.evidenceCreated, false, "capture did NOT collapse into Evidence derivation");

const liveEvidence = await api(cookie, {
  operation: "derive_evidence",
  workspaceId,
  projectId,
  normalizedEventId: liveCaptured.body.normalizedEvent.id,
  idempotencyKey: `live-evidence-${suffix}`,
  assertionType: "FACT",
  classification: "DELIVERY",
  confidenceScore: 0.9,
  missingDataState: "COMPLETE",
  evaluatedAt: new Date().toISOString(),
});
equal(liveEvidence.status, 201, "LIVE Evidence derives as a separate transition");
equal(String(liveEvidence.body.evidence.fixture_state), "LIVE", "LIVE Evidence is LIVE");

const afterLive = await summary(cookie, workspaceId, projectId);
check(
  (afterLive.observationEligibleEvidence ?? []).some(
    (row) => String(row.id) === String(liveEvidence.body.evidence.id),
  ),
  "LIVE Evidence IS Observation-eligible — eligibility was not weakened by the repair",
);

// ───────────────────────────── C: persisted classification mismatch ─────────────────────────────
//
// Proven on NON-reserved keys, because the reserved keys can no longer be misclassified at
// all. This is the guard that protects caller-defined connector and demo identities, and
// any reserved row that predates this migration: the contract refuses a Source whose
// persisted classification does not match the lineage writing to it, and does NOT repair
// the row by relabelling it.

console.log("\n── C: a Source whose persisted classification mismatches is refused ──");

const strayLiveKey = `p2-14-stray-live-${suffix.slice(-8)}:v1`.toLowerCase();
const strayFixtureKey = `p2-14-stray-fixture-${suffix.slice(-8)}:v1`.toLowerCase();

const strayLive = await admin.from("operational_sources").insert({
  workspace_id: workspaceId,
  project_id: projectId,
  source_key: strayLiveKey,
  source_kind: "connector",
  display_name: "Pre-existing non-fixture source",
  status: "active",
  is_fixture: false,
  created_by: owner.id,
});
assert.ifError(strayLive.error);

const demoAgainstLive = await captureDemoRpc(owner.client, workspaceId, projectId, strayLiveKey);
check(demoAgainstLive.error !== null, "DEMO capture against a persisted NON-fixture Source is refused");
equal(
  rpcCode(demoAgainstLive),
  "intake_source_kind_mismatch",
  "refusal is the classification assertion the DEMO contract previously lacked",
);

const strayFixture = await admin.from("operational_sources").insert({
  workspace_id: workspaceId,
  project_id: projectId,
  source_key: strayFixtureKey,
  source_kind: "manual_demo",
  display_name: "Pre-existing fixture source",
  status: "active",
  is_fixture: true,
  fixture_label: "DEMO / FIXTURE",
  fixture_expires_when: ["P2-14"],
  created_by: owner.id,
});
assert.ifError(strayFixture.error);

const liveAgainstFixture = await captureLiveRpc(owner.client, workspaceId, projectId, strayFixtureKey);
check(liveAgainstFixture.error !== null, "LIVE capture against a persisted fixture Source is refused");
equal(
  rpcCode(liveAgainstFixture),
  "intake_source_fixture_prohibited",
  "the pre-existing fixture refusal is intact",
);

const strayLiveAfter = await sourceRow(workspaceId, projectId, strayLiveKey);
const strayFixtureAfter = await sourceRow(workspaceId, projectId, strayFixtureKey);
equal(strayLiveAfter.is_fixture, false, "refused DEMO capture did not relabel the Source");
equal(strayFixtureAfter.is_fixture, true, "refused LIVE capture did not relabel the Source");

// ───────────────────────────── retry / idempotency ─────────────────────────────
//
// One logical submission retried under the SAME identity must reconcile onto the persisted
// Raw Input and Normalized Event rather than appending a second orphan pair.

console.log("\n── Retry under one submission identity reconciles ──");

const retryIdempotencyKey = `live-capture:${randomUUID()}`;
const retryBody = {
  operation: "capture_live_input",
  workspaceId,
  projectId,
  idempotencyKey: retryIdempotencyKey,
  title: "LIVE retry probe",
  content: "An ambiguous retry of one human submission must not duplicate canonical nodes.",
  occurredAt: new Date().toISOString(),
  correlationId: randomUUID(),
};

const firstAttempt = await api(cookie, retryBody);
equal(firstAttempt.status, 201, "first attempt captured");
equal(firstAttempt.body.disposition, "created", "first attempt created canonical nodes");

// A genuine retry from a browser that has moved on: fresh correlation id, same identity.
const secondAttempt = await api(cookie, { ...retryBody, correlationId: randomUUID() });
equal(secondAttempt.body.disposition, "duplicate", "retry reconciled instead of creating");
equal(
  String(secondAttempt.body.rawInput.id),
  String(firstAttempt.body.rawInput.id),
  "retry resolved the SAME Raw Input",
);
equal(
  String(secondAttempt.body.normalizedEvent.id),
  String(firstAttempt.body.normalizedEvent.id),
  "retry resolved the SAME Normalized Event",
);

const rawCount = await admin
  .from("operational_raw_inputs")
  .select("id", { count: "exact", head: true })
  .eq("workspace_id", workspaceId)
  .eq("project_id", projectId)
  .eq("idempotency_key", retryIdempotencyKey);
assert.ifError(rawCount.error);
equal(rawCount.count, 1, "exactly one Raw Input persisted for the retried submission");

console.log(`\nPASS: P2-14 Source classification gate — ${assertions} assertions.`);
