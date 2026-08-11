import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

const supabaseUrl = process.env.OPERATIONAL_FLOW_TEST_SUPABASE_URL;
const anonKey = process.env.OPERATIONAL_FLOW_TEST_ANON_KEY;
const serviceRoleKey = process.env.OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY;
const appBaseUrl = process.env.OPERATIONAL_FLOW_TEST_BASE_URL?.replace(/\/$/, "");
const databaseUrl = process.env.OPERATIONAL_FLOW_TEST_DATABASE_URL;
const browserFixturePath = process.env.P2_06_BROWSER_FIXTURE_PATH;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !appBaseUrl || !databaseUrl || process.env.OPERATIONAL_FLOW_TEST_ALLOW_DESTRUCTIVE !== "true") {
  console.error([
    "P2-06 live verification requires the disposable local PMFreak stack.",
    "Set OPERATIONAL_FLOW_TEST_SUPABASE_URL, OPERATIONAL_FLOW_TEST_ANON_KEY,",
    "OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY, OPERATIONAL_FLOW_TEST_BASE_URL,",
    "OPERATIONAL_FLOW_TEST_DATABASE_URL and OPERATIONAL_FLOW_TEST_ALLOW_DESTRUCTIVE=true.",
  ].join("\n"));
  process.exit(2);
}

for (const [name, target] of [["Supabase API", supabaseUrl], ["PMFreak", appBaseUrl], ["PostgreSQL", databaseUrl]]) {
  let host;
  try { host = new URL(target).hostname; } catch { console.error(`SAFETY ABORT: invalid ${name} URL.`); process.exit(2); }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
    console.error(`SAFETY ABORT: ${name} must use a literal loopback host.`); process.exit(2);
  }
}
if (appBaseUrl !== "http://localhost:3000") {
  console.error("SAFETY ABORT: browser/runtime origin must be http://localhost:3000."); process.exit(2);
}

const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const makeClient = () => createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const password = `P2-06-${randomUUID()}!`;
const users = {};
let assertions = 0;
const check = (condition, message) => { assert.ok(condition, message); assertions += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); assertions += 1; };

async function createUser(label) {
  const email = `p2-06-${label}-${suffix}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  const client = makeClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);
  users[label] = { id: created.data.user.id, email, client };
}

async function loginCookie(email) {
  const form = new FormData();
  form.set("email", email); form.set("password", password); form.set("next", "/projects");
  const response = await fetch(`${appBaseUrl}/api/login`, { method: "POST", body: form, redirect: "manual" });
  const values = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean);
  check(values.length > 0, "authenticated login must return cookies");
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function api(cookie, body) {
  const response = await fetch(`${appBaseUrl}/api/operational-flow`, {
    method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

async function makeDecision(cookie, workspaceId, projectId) {
  const now = new Date().toISOString();
  const correlationId = randomUUID();
  const captured = await api(cookie, { operation: "capture_input", workspaceId, projectId, sourceKey: "p2-06-verifier:v1", idempotencyKey: `capture-${suffix}`, title: "DEMO / FIXTURE governed action", content: "Additional work outside scope without formal approval creates a controlled scope risk.", occurredAt: now, correlationId });
  equal(captured.status, 201, "fixture input capture");
  const derived = await api(cookie, { operation: "derive_evidence", workspaceId, projectId, normalizedEventId: captured.body.normalizedEvent.id, idempotencyKey: `evidence-${suffix}`, assertionType: "FACT", classification: "DECISION_CONTEXT", confidenceScore: 0.95, missingDataState: "COMPLETE", evaluatedAt: now });
  equal(derived.status, 201, "fixture evidence derivation");
  const chain = await api(cookie, { operation: "run_chain", workspaceId, projectId, evidenceItemId: derived.body.evidence.id });
  equal(chain.status, 200, "fixture governance chain");
  const recommendation = await admin.from("recommended_actions").select("id").eq("project_id", projectId).not("governance_event_id", "is", null).order("created_at", { ascending: true }).limit(1).single();
  assert.ifError(recommendation.error);
  const decision = await api(cookie, { operation: "record_decision", workspaceId, projectId, recommendationId: recommendation.data.id, decisionStatus: "accepted", decision: "DEMO / FIXTURE accepted decision", rationale: "Controlled local P2-06 verification." });
  equal(decision.status, 201, "fixture decision record");
  return { decisionId: decision.body.decision.id, evidenceId: derived.body.evidence.id };
}

function proposal(workspaceId, projectId, decisionId, key, effect, overrides = {}) {
  const at = "2026-08-11T16:00:00.000Z";
  return { operation: "propose_material_action", workspaceId, projectId, decisionId, idempotencyKey: key,
    actionClass: "external_write", actionType: "schedule_change_proposal", targetResourceType: "project_schedule", targetResourceId: projectId,
    intendedOperation: "propose_only", intendedEffect: effect, risk: "high", reversibility: "partially_reversible", sideEffect: "external",
    justification: "P2-06 live verifier", createdAt: at, evaluationTime: at, expiresAt: "2026-08-12T16:00:00.000Z", ...overrides };
}

await createUser("owner"); await createUser("viewer"); await createUser("outsider");
const workspaceA = randomUUID(); const workspaceB = randomUUID(); const projectA = randomUUID(); const projectB = randomUUID();
assert.ifError((await admin.from("workspaces").insert([
  { id: workspaceA, name: `P2-06 DEMO A ${suffix}`, created_by_user_id: users.owner.id },
  { id: workspaceB, name: `P2-06 DEMO B ${suffix}`, created_by_user_id: users.outsider.id },
])).error);
assert.ifError((await admin.from("workspace_memberships").insert([
  { workspace_id: workspaceA, user_id: users.owner.id, role: "owner" },
  { workspace_id: workspaceA, user_id: users.viewer.id, role: "viewer" },
  { workspace_id: workspaceB, user_id: users.outsider.id, role: "owner" },
])).error);
assert.ifError((await admin.from("projects").insert([
  { id: projectA, workspace_id: workspaceA, user_id: users.owner.id, name: `P2-06 DEMO Project A ${suffix}` },
  { id: projectB, workspace_id: workspaceB, user_id: users.outsider.id, name: `P2-06 DEMO Project B ${suffix}` },
])).error);
const inviteId = randomUUID();
assert.ifError((await admin.from("early_access_invites").insert({ id: inviteId, invite_email: users.owner.email,
  invite_token_hash: randomUUID().replaceAll("-", ""), inviter_user_id: users.owner.id, expires_at: "2026-09-11T00:00:00.000Z",
  accepted_at: "2026-08-11T00:00:00.000Z", workspace_id: workspaceA })).error);
assert.ifError((await admin.from("trial_licenses").insert({ invite_id: inviteId, workspace_id: workspaceA,
  trial_start_at: "2026-08-11T00:00:00.000Z", trial_end_at: "2026-09-11T00:00:00.000Z", trial_status: "active" })).error);

const ownerCookie = await loginCookie(users.owner.email);
const viewerCookie = await loginCookie(users.viewer.email);
const outsiderCookie = await loginCookie(users.outsider.email);
const { decisionId, evidenceId } = await makeDecision(ownerCookie, workspaceA, projectA);
const unavailableDecisionId = randomUUID();
assert.ifError((await admin.from("operational_decision_records").insert({
  id: unavailableDecisionId, workspace_id: workspaceA, project_id: projectA, recommendation_id: null, governance_event_id: null,
  decided_by: users.owner.id, decision: "DEMO / FIXTURE policy-unavailable decision", decision_status: "accepted",
  rationale: "Controlled local fail-closed policy-unavailable state.", authority_basis: "local_verifier_fixture",
  authority_evaluation: { fixture: true, state: "unavailable" },
})).error);
assert.ifError((await admin.from("decision_evidence_links").insert({ decision_record_id: unavailableDecisionId, evidence_item_id: evidenceId,
  link_reason: "DEMO / FIXTURE unavailable governance projection", evidence_hash_at_decision: "0".repeat(64), evidence_version_at_decision: 1,
  evidence_title_snapshot: "trigger-populated" })).error);

const identicalBody = proposal(workspaceA, projectA, decisionId, `identical-${suffix}`, "Identical concurrent schedule proposal");
const identical = await Promise.all(Array.from({ length: 8 }, () => api(ownerCookie, identicalBody)));
equal(identical.filter((x) => x.status === 201).length, 1, "one identical request creates");
equal(identical.filter((x) => x.status === 200).length, 7, "seven identical requests replay");
const identicalIds = new Set(identical.map((x) => x.body.proposal?.id));
const identicalDigests = new Set(identical.map((x) => x.body.proposal?.proposal_digest));
const identicalEvaluations = new Set(identical.map((x) => x.body.evaluation?.id));
equal(identicalIds.size, 1, "identical action identity"); equal(identicalDigests.size, 1, "identical digest"); equal(identicalEvaluations.size, 1, "identical evaluation identity");
const identicalId = [...identicalIds][0];
equal((await admin.from("material_action_proposals").select("id", { count: "exact", head: true }).eq("id", identicalId)).count, 1, "one proposal row");
equal((await admin.from("material_action_governance_evaluations").select("id", { count: "exact", head: true }).eq("action_id", identicalId)).count, 1, "one evaluation row");
equal((await admin.from("material_action_audit_events").select("id", { count: "exact", head: true }).eq("action_id", identicalId)).count, 1, "one success audit row");

const conflictKey = `conflict-${suffix}`;
const conflicting = await Promise.all([
  api(ownerCookie, proposal(workspaceA, projectA, decisionId, conflictKey, "Move milestone by two days")),
  api(ownerCookie, proposal(workspaceA, projectA, decisionId, conflictKey, "Move milestone by five days")),
]);
equal(conflicting.filter((x) => x.status === 201).length, 1, "one conflicting input wins");
equal(conflicting.filter((x) => x.status === 409).length, 1, "one conflicting input is rejected");
const winner = conflicting.find((x) => x.status === 201); const loserIndex = conflicting.findIndex((x) => x.status === 409); const winnerIndex = winner === conflicting[0] ? 0 : 1;
const winnerBody = [proposal(workspaceA, projectA, decisionId, conflictKey, "Move milestone by two days"), proposal(workspaceA, projectA, decisionId, conflictKey, "Move milestone by five days")][winnerIndex];
const loserBody = [proposal(workspaceA, projectA, decisionId, conflictKey, "Move milestone by two days"), proposal(workspaceA, projectA, decisionId, conflictKey, "Move milestone by five days")][loserIndex];
equal((await api(ownerCookie, winnerBody)).status, 200, "winner replays"); equal((await api(ownerCookie, loserBody)).status, 409, "loser remains conflict");
equal((await admin.from("material_action_proposals").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceA).eq("idempotency_key", conflictKey)).count, 1, "one conflicting proposal row");
equal((await admin.from("material_action_governance_evaluations").select("id", { count: "exact", head: true }).eq("action_id", winner.body.proposal.id)).count, 1, "one conflicting evaluation row");
equal((await admin.from("material_action_audit_events").select("id", { count: "exact", head: true }).eq("action_id", winner.body.proposal.id).eq("event_type", "conflict")).count, 2, "each losing conflict is audited");

const denied = await api(ownerCookie, proposal(workspaceA, projectA, decisionId, `denied-${suffix}`, "Prohibited elevation", { actionClass: "knowledge_elevation", actionType: "prohibited_knowledge_elevation", sideEffect: "knowledge" }));
equal(denied.status, 201, "denied state persists"); equal(denied.body.evaluation.governance_state, "denied", "denied state");
const degraded = await api(ownerCookie, proposal(workspaceA, projectA, decisionId, `degraded-${suffix}`, "Unknown-risk proposal", { risk: "unknown", reversibility: "unknown" }));
equal(degraded.status, 201, "degraded state persists"); equal(degraded.body.evaluation.governance_state, "degraded", "degraded state");
const unavailable = await api(ownerCookie, proposal(workspaceA, projectA, unavailableDecisionId, `${unavailableDecisionId}:authorized:p2-06-v1`, "Policy-unavailable proposal"));
equal(unavailable.status, 201, "unavailable state persists"); equal(unavailable.body.evaluation.governance_state, "unavailable", "unavailable state");
const revokedSource = await api(ownerCookie, proposal(workspaceA, projectA, decisionId, `revoked-${suffix}`, "Revocable proposal"));
const revoked = await api(ownerCookie, { operation: "revoke_material_action", workspaceId: workspaceA, projectId: projectA, actionId: revokedSource.body.proposal.id, evaluationTime: "2026-08-11T16:05:00.000Z", reasonCode: "verifier_revocation" });
equal(revoked.status, 200, "revocation succeeds"); equal(revoked.body.evaluation.governance_state, "revoked", "revoked state");

for (const table of ["material_action_proposals", "material_action_governance_evaluations", "material_action_audit_events"]) {
  const outsiderRead = await users.outsider.client.from(table).select("id").eq("workspace_id", workspaceA);
  assert.ifError(outsiderRead.error); equal(outsiderRead.data.length, 0, `${table} cross-tenant read denied`);
}
equal((await api(outsiderCookie, proposal(workspaceA, projectA, decisionId, `outsider-${suffix}`, "Cross tenant"))).status, 403, "cross-tenant API denied");
equal((await api(viewerCookie, proposal(workspaceA, projectA, decisionId, `viewer-${suffix}`, "Viewer write"))).status, 403, "viewer API denied");
equal((await api(null, proposal(workspaceA, projectA, decisionId, `anon-${suffix}`, "Anonymous write"))).status, 401, "anonymous API denied");

const immutableBefore = await admin.from("material_action_proposals").select("proposal_digest,source_decision_id").eq("id", identicalId).single(); assert.ifError(immutableBefore.error);
const directInsert = await users.owner.client.from("material_action_proposals").insert({ id: randomUUID() }); check(Boolean(directInsert.error), "authenticated direct insert denied");
const directUpdate = await users.owner.client.from("material_action_proposals").update({ proposal_digest: "b".repeat(64) }).eq("id", identicalId).select(); check(Boolean(directUpdate.error) || directUpdate.data.length === 0, "authenticated update denied");
const directDelete = await users.owner.client.from("material_action_proposals").delete().eq("id", identicalId).select(); check(Boolean(directDelete.error) || directDelete.data.length === 0, "authenticated delete denied");
const serviceUpdate = await admin.from("material_action_proposals").update({ proposal_digest: "b".repeat(64) }).eq("id", identicalId); check(Boolean(serviceUpdate.error), "immutable trigger denies service-role mutation");
const immutableAfter = await admin.from("material_action_proposals").select("proposal_digest,source_decision_id").eq("id", identicalId).single(); assert.deepEqual(immutableAfter.data, immutableBefore.data); assertions += 1;

for (const [table, projectScoped] of [["execution_tasks", true], ["decision_outcomes", true], ["operational_decision_outcomes", false], ["agent_execution_outcomes", false], ["agent_execution_learning_signals", false]]) {
  let query = admin.from(table).select("id", { count: "exact", head: true }).eq("workspace_id", workspaceA);
  if (projectScoped) query = query.eq("project_id", projectA);
  const result = await query;
  assert.ifError(result.error); equal(result.count, 0, `${table} remains empty`);
}

if (browserFixturePath) writeFileSync(browserFixturePath, JSON.stringify({ origin: appBaseUrl, email: users.owner.email, password, workspaceId: workspaceA, projectId: projectA, decisionId, unavailableDecisionId, evidenceId, correlationActionId: identicalId }), { mode: 0o600 });
console.log(`P2-06 live verifier PASS: ${assertions} assertions; identical concurrency 8 (1 create, 7 replay); conflicting concurrency 2 (1 create, 1 conflict).`);
console.log("Fixtures are UUID-tagged and exist only in the disposable local database; final no-backup stack teardown removes them.");
