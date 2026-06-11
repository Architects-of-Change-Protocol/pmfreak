import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SCENARIO_KEY = "client_scope_alignment_v1";
const args = process.argv.slice(2);
const reset = args.includes("--reset");
const positional = args.filter((arg) => arg !== "--reset");
const workspaceId = positional[0]?.trim();
const actorUserId = positional[1]?.trim();
if (!workspaceId || !actorUserId) {
  console.error("Usage: npm run seed:operational-flow -- <workspace-id> <actor-user-id> [--reset]");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const fail = (operation, error) => { if (error) throw new Error(`${operation}: ${error.message}`); };
const stableId = (name) => {
  const hex = createHash("sha256").update(`${workspaceId}:${SCENARIO_KEY}:${name}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const { data: membership, error: membershipError } = await db.from("workspace_memberships").select("role").eq("workspace_id", workspaceId).eq("user_id", actorUserId).maybeSingle();
fail("verify_workspace_membership", membershipError);
if (!membership || !["owner", "admin"].includes(membership.role)) throw new Error("The demo actor must be an owner or admin of the target workspace.");

const { data: keyedProjects, error: projectLoadError } = await db.from("projects").select("id,name,onboarding_payload").eq("workspace_id", workspaceId).contains("onboarding_payload", { demoScenarioKey: SCENARIO_KEY }).order("created_at", { ascending: true });
fail("load_demo_project", projectLoadError);
let project = keyedProjects?.[0] ?? null;
let projectDisposition = "reused";
if (!project) {
  const created = await db.from("projects").insert({ workspace_id: workspaceId, user_id: actorUserId, name: "Demo Project — Client Scope Alignment", description: "Auditable PMFreak evidence-to-decision demonstration.", onboarding_payload: { demoScenarioKey: SCENARIO_KEY, demo: true } }).select("id,name,onboarding_payload").single();
  fail("create_demo_project", created.error); project = created.data; projectDisposition = "created";
}
const projectId = project.id;

const ids = Object.fromEntries(["evidence","scopeSignal","approvalSignal","change","decisionNeeded","scopeGovernance","approvalGovernance","scopeRecommendation","approvalRecommendation","decision","run","output","link"].map((name) => [name, stableId(name)]));

async function cleanupScenario() {
  const signalIds = [ids.scopeSignal, ids.approvalSignal];
  const riskIds = [ids.change, ids.decisionNeeded];
  const governanceIds = [ids.scopeGovernance, ids.approvalGovernance];
  const recommendationIds = [ids.scopeRecommendation, ids.approvalRecommendation];
  for (const [table, column, values] of [
    ["decision_evidence_links", "decision_record_id", [ids.decision]],
    ["operational_decision_records", "id", [ids.decision]],
    ["recommended_actions", "id", recommendationIds],
    ["governance_events", "id", governanceIds],
    ["risk_issue_records", "id", riskIds],
    ["operational_signals", "id", signalIds],
    ["agent_outputs", "agent_run_id", [ids.run]],
    ["agent_runs", "id", [ids.run]],
    ["evidence_items", "id", [ids.evidence]],
  ]) {
    const result = await db.from(table).delete().in(column, values);
    fail(`reset_${table}`, result.error);
  }
}

const { data: existingEvidence, error: existingError } = await db.from("evidence_items").select("id").eq("id", ids.evidence).maybeSingle();
fail("check_demo_scenario", existingError);
let disposition = existingEvidence ? "reused" : "created";
if (reset || existingEvidence) {
  const checks = await Promise.all([
    db.from("operational_signals").select("id", { count: "exact", head: true }).in("id", [ids.scopeSignal, ids.approvalSignal]),
    db.from("risk_issue_records").select("id", { count: "exact", head: true }).in("id", [ids.change, ids.decisionNeeded]),
    db.from("governance_events").select("id", { count: "exact", head: true }).in("id", [ids.scopeGovernance, ids.approvalGovernance]),
    db.from("recommended_actions").select("id", { count: "exact", head: true }).in("id", [ids.scopeRecommendation, ids.approvalRecommendation]),
    db.from("operational_decision_records").select("id", { count: "exact", head: true }).eq("id", ids.decision),
    db.from("decision_evidence_links").select("id", { count: "exact", head: true }).eq("decision_record_id", ids.decision),
    db.from("agent_runs").select("id", { count: "exact", head: true }).eq("id", ids.run),
    db.from("agent_outputs").select("id", { count: "exact", head: true }).eq("id", ids.output),
    db.from("recommended_actions").select("status,decided_by").eq("id", ids.scopeRecommendation).maybeSingle(),
    db.from("evidence_items").select("frozen_at,metadata").eq("id", ids.evidence).maybeSingle(),
  ]);
  checks.forEach((result, index) => fail(`verify_demo_chain_${index}`, result.error));
  const countsComplete = checks.slice(0, 8).map((result) => result.count ?? 0).join(",") === "2,2,2,2,1,1,1,1";
  const recommendationComplete = checks[8].data?.status === "accepted" && checks[8].data?.decided_by === actorUserId;
  const evidenceComplete = Boolean(checks[9].data?.frozen_at) && checks[9].data?.metadata?.demoScenarioKey === SCENARIO_KEY;
  const complete = !reset && countsComplete && recommendationComplete && evidenceComplete;
  if (complete) {
    console.log(JSON.stringify({ ok: true, disposition, projectDisposition, workspaceId, projectId, scenarioKey: SCENARIO_KEY, commandCenterUrl: `/command-center?projectId=${projectId}`, counts: { evidence: 1, signals: 2, risksIssues: 2, governanceEvents: 2, recommendations: 2, decisions: 1, evidenceLinks: 1 } }, null, 2));
    process.exit(0);
  }
  await cleanupScenario();
  disposition = reset ? "reset" : "repaired";
}

const evidenceContent = "The client requested an additional activity outside the agreed scope and asked the team to start without formal approval.";
const { data: evidence, error: evidenceError } = await db.from("evidence_items").insert({ id: ids.evidence, workspace_id: workspaceId, project_id: projectId, created_by: actorUserId, source_type: "email", title: "Client request for out-of-scope activity", content: evidenceContent, source_reference: "demo://client-scope-email", confidence_level: "high", status: "analyzed", evidence_hash: "0".repeat(64), version: 1, frozen_at: new Date().toISOString(), metadata: { demo: true, demoScenarioKey: SCENARIO_KEY } }).select("evidence_hash,version,title,source_reference").single();
fail("create_demo_evidence", evidenceError);
const signalRows = [
  { id: ids.scopeSignal, workspace_id: workspaceId, project_id: projectId, evidence_item_id: ids.evidence, signal_type: "scope_creep", severity: "high", confidence_score: 92, summary: "Work outside the agreed scope was requested.", rationale: "Deterministic v1 rule matched explicit out-of-scope language.", detected_by: "system/deterministic:governance_signal_detector_v1", status: "open" },
  { id: ids.approvalSignal, workspace_id: workspaceId, project_id: projectId, evidence_item_id: ids.evidence, signal_type: "missing_approval", severity: "high", confidence_score: 95, summary: "Required approval is absent or unresolved.", rationale: "Deterministic v1 rule matched explicit missing-approval language.", detected_by: "system/deterministic:governance_signal_detector_v1", status: "open" },
];
fail("create_demo_signals", (await db.from("operational_signals").insert(signalRows)).error);
fail("create_demo_risks", (await db.from("risk_issue_records").insert([
  { id: ids.change, workspace_id: workspaceId, project_id: projectId, signal_id: ids.scopeSignal, type: "change", title: "Out-of-scope client request", description: "Requested activity is not in the agreed scope.", severity: "high", probability: "high", impact: "high", owner_user_id: actorUserId, status: "open" },
  { id: ids.decisionNeeded, workspace_id: workspaceId, project_id: projectId, signal_id: ids.approvalSignal, type: "decision_needed", title: "Formal approval required", description: "Execution was requested before formal approval.", severity: "high", probability: "high", impact: "high", owner_user_id: actorUserId, status: "open" },
])).error);
fail("create_demo_governance", (await db.from("governance_events").insert([
  { id: ids.scopeGovernance, workspace_id: workspaceId, project_id: projectId, related_entity_type: "risk_issue_record", related_entity_id: ids.change, rule_key: "scope_authority_v1", authority_required: "sponsor or PMO", evidence_required: true, governance_status: "decision_required", explanation: "A scope change requires sponsor or PMO authority and a traceable decision before execution." },
  { id: ids.approvalGovernance, workspace_id: workspaceId, project_id: projectId, related_entity_type: "risk_issue_record", related_entity_id: ids.decisionNeeded, rule_key: "approval_required_v1", authority_required: "authorized approver", evidence_required: true, governance_status: "decision_required", explanation: "Formal approval is missing; work must not proceed until an authorized human decides." },
])).error);
const recommendation = "Request formal scope and approval confirmation before executing the requested work.";
fail("create_demo_recommendations", (await db.from("recommended_actions").insert([
  { id: ids.scopeRecommendation, workspace_id: workspaceId, project_id: projectId, governance_event_id: ids.scopeGovernance, risk_issue_id: ids.change, title: "Confirm scope before execution", description: recommendation, recommendation, recommended_action_type: "validate_scope", status: "proposed", confidence_score: 92, impact_level: "high", rationale: { method: "deterministic_rule_v1" }, urgency: "high", evidence_summary: { evidenceItemId: ids.evidence, evidenceHash: evidence.evidence_hash, evidenceVersion: evidence.version, signalId: ids.scopeSignal }, source_signal_id: ids.scopeSignal, fingerprint: createHash("sha256").update(`${workspaceId}:${ids.scopeGovernance}`).digest("hex"), decision_reason: "Do not execute until formal confirmation is received.", decided_by: actorUserId, decided_at: new Date().toISOString() },
  { id: ids.approvalRecommendation, workspace_id: workspaceId, project_id: projectId, governance_event_id: ids.approvalGovernance, risk_issue_id: ids.decisionNeeded, title: "Obtain formal approval", description: recommendation, recommendation, recommended_action_type: "request_approval", status: "proposed", confidence_score: 95, impact_level: "high", rationale: { method: "deterministic_rule_v1" }, urgency: "high", evidence_summary: { evidenceItemId: ids.evidence, evidenceHash: evidence.evidence_hash, evidenceVersion: evidence.version, signalId: ids.approvalSignal }, source_signal_id: ids.approvalSignal, fingerprint: createHash("sha256").update(`${workspaceId}:${ids.approvalGovernance}`).digest("hex") },
])).error);
const authorityEvaluation = { allowed: true, actor_role: membership.role, authority_required: "sponsor or PMO", authority_basis: `${membership.role} workspace authority (PMFreak role mapping v1)`, reason: "workspace_authority", mapping: "pmfreak_role_mapping_v1", demoSeed: true };
fail("create_demo_decision", (await db.from("operational_decision_records").insert({ id: ids.decision, workspace_id: workspaceId, project_id: projectId, recommendation_id: ids.scopeRecommendation, governance_event_id: ids.scopeGovernance, decided_by: actorUserId, decision: "Accept recommendation: obtain formal confirmation before execution.", decision_status: "accepted", rationale: "Protect scope, schedule and commercial position before committing delivery capacity.", authority_basis: authorityEvaluation.authority_basis, authority_evaluation: authorityEvaluation })).error);
fail("link_demo_evidence", (await db.from("decision_evidence_links").insert({ id: ids.link, decision_record_id: ids.decision, evidence_item_id: ids.evidence, link_reason: "Client email contains the out-of-scope request and absence of formal approval.", evidence_hash_at_decision: evidence.evidence_hash, evidence_version_at_decision: evidence.version, evidence_title_snapshot: evidence.title, evidence_source_reference_snapshot: evidence.source_reference })).error);
fail("transition_demo_recommendation", (await db.from("recommended_actions").update({ status: "accepted", decision_reason: "Do not execute until formal confirmation is received.", decided_by: actorUserId, decided_at: new Date().toISOString() }).eq("id", ids.scopeRecommendation)).error);
fail("create_demo_run", (await db.from("agent_runs").insert({ id: ids.run, workspace_id: workspaceId, project_id: projectId, agent_key: "system/deterministic:governance_signal_detector_v1", input_summary: "Client request for out-of-scope activity", status: "completed" })).error);
fail("create_demo_output", (await db.from("agent_outputs").insert({ id: ids.output, agent_run_id: ids.run, output_type: "operational_chain", output_payload: { detectorKind: "system/deterministic", scenarioKey: SCENARIO_KEY, signalIds: [ids.scopeSignal, ids.approvalSignal] } })).error);

console.log(JSON.stringify({ ok: true, disposition, projectDisposition, workspaceId, projectId, scenarioKey: SCENARIO_KEY, commandCenterUrl: `/command-center?projectId=${projectId}`, counts: { evidence: 1, signals: 2, risksIssues: 2, governanceEvents: 2, recommendations: 2, decisions: 1, evidenceLinks: 1 } }, null, 2));
