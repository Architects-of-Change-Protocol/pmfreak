import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

// Guard runs before any network-dependent import so the script exits 2 (not 1)
// when infrastructure is absent. See docs/operational-flow-runtime-gate.md.
const url = process.env.OPERATIONAL_FLOW_TEST_SUPABASE_URL;
const anonKey = process.env.OPERATIONAL_FLOW_TEST_ANON_KEY;
const serviceRoleKey = process.env.OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY;
const appBaseUrl = process.env.OPERATIONAL_FLOW_TEST_BASE_URL?.replace(/\/$/, "");
if (!url || !anonKey || !serviceRoleKey || !appBaseUrl || process.env.OPERATIONAL_FLOW_TEST_ALLOW_DESTRUCTIVE !== "true") {
  console.error([
    "Operational-flow DB/RLS verification requires an isolated, migrated Supabase project.",
    "Set OPERATIONAL_FLOW_TEST_SUPABASE_URL, OPERATIONAL_FLOW_TEST_ANON_KEY,",
    "OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY, OPERATIONAL_FLOW_TEST_BASE_URL and",
    "OPERATIONAL_FLOW_TEST_ALLOW_DESTRUCTIVE=true.",
    "This check creates and deletes auth users, workspaces, projects and operational records.",
    "See docs/operational-flow-runtime-gate.md for setup instructions.",
    "NEVER run this check against a production Supabase project.",
  ].join("\n"));
  process.exit(2);
}

// Production safeguard: reject any URL that looks like a real Supabase project
// (i.e. not localhost and not a known local/CI pattern). Adjust the allowlist
// if your isolated environment uses a custom domain.
if (!/localhost|127\.0\.0\.1|0\.0\.0\.0|\.local(:\d+)?$/.test(url) && !process.env.OPERATIONAL_FLOW_TEST_ALLOW_REMOTE === "true") {
  const { hostname } = new URL(url);
  if (!hostname.includes("localhost") && !hostname.includes("127.0.0.1")) {
    console.error(`SAFETY ABORT: OPERATIONAL_FLOW_TEST_SUPABASE_URL points to a remote host (${hostname}).\nThis check creates and deletes real data. Only run it against an isolated local Supabase instance.\nIf you intentionally want to run against a remote isolated project, set OPERATIONAL_FLOW_TEST_ALLOW_REMOTE=true.`);
    process.exit(2);
  }
}

const { createClient } = await import("@supabase/supabase-js");

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const clientFor = () => createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = `Pmfreak-${randomUUID()}!`;
const users = {};
let workspaceA;
let workspaceB;

async function createUser(label) {
  const email = `operational-flow-${label}-${suffix}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(error);
  users[label] = { id: data.user.id, email };
  const client = clientFor();
  const login = await client.auth.signInWithPassword({ email, password });
  assert.ifError(login.error);
  return client;
}

async function expectDenied(promise, label) {
  const result = await promise;
  assert.ok(result.error, `${label}: expected a database denial`);
  return result.error;
}

async function loginCookie(email) {
  const form = new FormData(); form.set("email", email); form.set("password", password); form.set("next", "/command-center");
  const response = await fetch(`${appBaseUrl}/api/login`, { method: "POST", body: form, redirect: "manual" });
  const setCookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean);
  assert.ok(setCookies.length, `login for ${email} must return auth cookies`);
  return setCookies.map((value) => value.split(";", 1)[0]).join("; ");
}

async function apiJson(path, options = {}) {
  const response = await fetch(`${appBaseUrl}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function cleanup() {
  if (workspaceA || workspaceB) {
    await admin.from("workspaces").delete().in("id", [workspaceA, workspaceB].filter(Boolean));
  }
  await Promise.all(Object.values(users).map(({ id }) => admin.auth.admin.deleteUser(id)));
}

try {
  const owner = await createUser("owner");
  const pm = await createUser("pm");
  const viewer = await createUser("viewer");
  await createUser("outsider");

  workspaceA = randomUUID(); workspaceB = randomUUID();
  const projectA = randomUUID(); const projectB = randomUUID();
  assert.ifError((await admin.from("workspaces").insert([
    { id: workspaceA, name: "Operational flow RLS A", created_by_user_id: users.owner.id },
    { id: workspaceB, name: "Operational flow RLS B", created_by_user_id: users.outsider.id },
  ])).error);
  assert.ifError((await admin.from("workspace_memberships").insert([
    { workspace_id: workspaceA, user_id: users.owner.id, role: "owner" },
    { workspace_id: workspaceA, user_id: users.pm.id, role: "pm" },
    { workspace_id: workspaceA, user_id: users.viewer.id, role: "viewer" },
    { workspace_id: workspaceB, user_id: users.outsider.id, role: "owner" },
  ])).error);
  assert.ifError((await admin.from("projects").insert([
    { id: projectA, workspace_id: workspaceA, user_id: users.owner.id, name: "Operational flow test A" },
    { id: projectB, workspace_id: workspaceB, user_id: users.outsider.id, name: "Operational flow test B" },
  ])).error);

  const ownerCookie = await loginCookie(users.owner.email);
  const viewerCookie = await loginCookie(users.viewer.email);
  const unauthorizedApi = await apiJson(`/api/operational-flow?workspaceId=${workspaceA}&projectId=${projectA}`);
  assert.equal(unauthorizedApi.response.status, 401);
  const viewerApi = await apiJson("/api/operational-flow", { method: "POST", headers: { "content-type": "application/json", cookie: viewerCookie }, body: JSON.stringify({ operation: "create_evidence", workspaceId: workspaceA, projectId: projectA, sourceType: "manual_note", title: "Viewer write", content: "Must be denied" }) });
  assert.equal(viewerApi.response.status, 403);
  const wrongScopeApi = await apiJson("/api/operational-flow", { method: "POST", headers: { "content-type": "application/json", cookie: ownerCookie }, body: JSON.stringify({ operation: "create_evidence", workspaceId: workspaceB, projectId: projectA, sourceType: "manual_note", title: "Wrong scope", content: "Must be denied" }) });
  assert.equal(wrongScopeApi.response.status, 403);
  const createApi = await apiJson("/api/operational-flow", { method: "POST", headers: { "content-type": "application/json", cookie: ownerCookie }, body: JSON.stringify({ operation: "create_evidence", workspaceId: workspaceA, projectId: projectA, sourceType: "email", title: "API scope request", content: "Additional work outside scope without formal approval.", sourceReference: "test://api" }) });
  assert.equal(createApi.response.status, 201);
  const apiEvidenceId = createApi.payload.evidence.id;
  const chainApi = await apiJson("/api/operational-flow", { method: "POST", headers: { "content-type": "application/json", cookie: ownerCookie }, body: JSON.stringify({ operation: "run_chain", workspaceId: workspaceA, projectId: projectA, evidenceItemId: apiEvidenceId }) });
  assert.equal(chainApi.response.status, 200);
  const apiRecommendation = await admin.from("recommended_actions").select("id").eq("project_id", projectA).eq("source_signal_id", chainApi.payload.chain[0].signal.id).single();
  assert.ifError(apiRecommendation.error);
  const decisionApi = await apiJson("/api/operational-flow", { method: "POST", headers: { "content-type": "application/json", cookie: ownerCookie }, body: JSON.stringify({ operation: "record_decision", workspaceId: workspaceA, projectId: projectA, recommendationId: apiRecommendation.data.id, decisionStatus: "accepted", decision: "Authorized API decision", rationale: "Owner role mapping verified." }) });
  assert.equal(decisionApi.response.status, 201);

  const evidenceInsert = {
    workspace_id: workspaceA, project_id: projectA, created_by: users.owner.id,
    source_type: "email", title: "Client asks for work outside scope",
    content: "Additional work outside scope was requested without formal approval.",
    source_reference: "test://scope-email", confidence_level: "high", status: "recorded",
    evidence_hash: "0".repeat(64), version: 1,
  };
  const ownerEvidence = await owner.from("evidence_items").insert(evidenceInsert).select("*").single();
  assert.ifError(ownerEvidence.error);
  assert.match(ownerEvidence.data.evidence_hash, /^[a-f0-9]{64}$/);

  await expectDenied(viewer.from("evidence_items").insert({ ...evidenceInsert, id: randomUUID(), created_by: users.viewer.id }), "viewer evidence insert");
  await expectDenied(owner.from("operational_signals").insert({
    workspace_id: workspaceA, project_id: projectA, evidence_item_id: ownerEvidence.data.id,
    signal_type: "scope_creep", severity: "high", confidence_score: 99,
    summary: "fabricated", rationale: "fabricated", detected_by: "user", status: "open",
  }), "normal-user signal insert");
  await expectDenied(owner.from("governance_events").insert({
    workspace_id: workspaceA, project_id: projectA, related_entity_type: "risk_issue_record",
    related_entity_id: randomUUID(), rule_key: "fabricated", authority_required: "none",
    evidence_required: false, governance_status: "compliant", explanation: "fabricated",
  }), "normal-user governance insert");

  const chain = await owner.rpc("materialize_operational_chain", { p_evidence_item_id: ownerEvidence.data.id });
  assert.ifError(chain.error);
  assert.equal(chain.data.chain.length, 2);
  const rerun = await owner.rpc("materialize_operational_chain", { p_evidence_item_id: ownerEvidence.data.id });
  assert.ifError(rerun.error);
  const signalCount = await owner.from("operational_signals").select("id", { count: "exact", head: true }).eq("evidence_item_id", ownerEvidence.data.id);
  assert.equal(signalCount.count, 2, "reprocessing must not duplicate signals");

  const recommendationResult = await owner.from("recommended_actions").select("id").eq("project_id", projectA).not("governance_event_id", "is", null).order("confidence_score", { ascending: true }).limit(1).single();
  assert.ifError(recommendationResult.error);
  const recommendationId = recommendationResult.data.id;
  await expectDenied(pm.rpc("record_operational_decision", {
    p_recommendation_id: recommendationId, p_manual_evidence_item_id: null,
    p_decision: "Accept", p_decision_status: "accepted", p_rationale: "PM lacks sponsor/PMO authority.",
  }), "PM sponsor-authority decision");

  await expectDenied(owner.from("recommended_actions").update({ status: "accepted" }).eq("id", recommendationId), "legacy/direct governed transition");
  const decision = await owner.rpc("record_operational_decision", {
    p_recommendation_id: recommendationId, p_manual_evidence_item_id: null,
    p_decision: "Accept after authorized review", p_decision_status: "accepted", p_rationale: "Owner authority verified by role mapping v1.",
  });
  assert.ifError(decision.error);
  assert.equal(decision.data.evidenceLinked, 1);
  const decisionId = decision.data.decision.id;
  const recommendationAfter = await owner.from("recommended_actions").select("status,decided_by").eq("id", recommendationId).single();
  assert.deepEqual(recommendationAfter.data, { status: "accepted", decided_by: users.owner.id });
  await expectDenied(owner.from("operational_decision_records").update({ rationale: "rewritten" }).eq("id", decisionId), "append-only decision");
  await expectDenied(owner.from("decision_evidence_links").update({ link_reason: "rewritten" }).eq("decision_record_id", decisionId), "append-only evidence link");
  await expectDenied(owner.from("evidence_items").update({ content: "rewritten" }).eq("id", ownerEvidence.data.id), "frozen evidence mutation");

  const outsiderEvidence = await admin.from("evidence_items").insert({ ...evidenceInsert, id: randomUUID(), workspace_id: workspaceB, project_id: projectB, created_by: users.outsider.id }).select("id").single();
  assert.ifError(outsiderEvidence.error);
  const crossRead = await owner.from("evidence_items").select("id").eq("id", outsiderEvidence.data.id);
  assert.ifError(crossRead.error); assert.equal(crossRead.data.length, 0, "cross-workspace read must be filtered by RLS");
  await expectDenied(owner.from("evidence_items").insert({ ...evidenceInsert, id: randomUUID(), workspace_id: workspaceB, project_id: projectB }), "cross-workspace write");

  const bulk = Array.from({ length: 35 }, (_, index) => {
    const evidenceId = randomUUID(), signalId = randomUUID(), riskId = randomUUID(), governanceId = randomUUID();
    return { evidenceId, signalId, riskId, governanceId, index };
  });
  assert.ifError((await admin.from("evidence_items").insert(bulk.map(({ evidenceId, index }) => ({ ...evidenceInsert, id: evidenceId, title: `Assurance evidence ${index}` })))).error);
  assert.ifError((await admin.from("operational_signals").insert(bulk.map(({ evidenceId, signalId, index }) => ({ id: signalId, workspace_id: workspaceA, project_id: projectA, evidence_item_id: evidenceId, signal_type: "schedule_risk", severity: "medium", confidence_score: 80, summary: `Signal ${index}`, rationale: "Count verification", detected_by: "system/deterministic:test", status: "open" })))).error);
  assert.ifError((await admin.from("risk_issue_records").insert(bulk.map(({ signalId, riskId, index }) => ({ id: riskId, workspace_id: workspaceA, project_id: projectA, signal_id: signalId, type: "risk", title: `Risk ${index}`, description: "Count verification", severity: "medium", probability: "medium", impact: "medium", status: "open" })))).error);
  assert.ifError((await admin.from("governance_events").insert(bulk.map(({ riskId, governanceId, index }) => ({ id: governanceId, workspace_id: workspaceA, project_id: projectA, related_entity_type: "risk_issue_record", related_entity_id: riskId, rule_key: `count_rule_${index}`, authority_required: "baseline review", evidence_required: false, governance_status: index % 2 ? "decision_required" : "violation", explanation: "Exact count verification" })))).error);
  const assurance = await owner.rpc("get_operational_assurance_summary", { p_workspace_id: workspaceA, p_project_id: projectA });
  assert.ifError(assurance.error);
  assert.ok(assurance.data.totalGovernanceEvents > 30, "assurance total must not be truncated to feed size");

  const seedEnv = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey };
  const firstSeed = JSON.parse(execFileSync(process.execPath, ["scripts/seed-operational-flow-demo.mjs", workspaceA, users.owner.id], { encoding: "utf8", env: seedEnv }));
  const secondSeed = JSON.parse(execFileSync(process.execPath, ["scripts/seed-operational-flow-demo.mjs", workspaceA, users.owner.id], { encoding: "utf8", env: seedEnv }));
  assert.equal(firstSeed.projectId, secondSeed.projectId); assert.equal(secondSeed.disposition, "reused");

  console.log(JSON.stringify({ ok: true, checks: ["role-aware evidence RLS", "derived-table direct writes denied", "cross-workspace denied", "transactional idempotent chain", "authority denial", "atomic decision/evidence/recommendation", "append-only audit trail", "frozen evidence", "exact assurance counts > 30", "idempotent seed", "authenticated API create/run/decision", "API 401/403 scope and role denials"] }, null, 2));
} finally {
  await cleanup();
}
