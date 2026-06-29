// ─── Controlled PMO Governance Intelligence Dashboard — Tests ─────────────────
// No LLM calls. No external API calls. No real side effects.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const typesFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-governance-dashboard-types.ts"), "utf8");
const validationFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-governance-dashboard-validation.ts"), "utf8");
const registryFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-governance-dashboard-registry.ts"), "utf8");
const serviceFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-governance-dashboard-service.ts"), "utf8");
const migrationFile = readFileSync(resolve(ROOT, "supabase/migrations/20260807000000_agent_controlled_pmo_governance_intelligence_dashboard.sql"), "utf8");
const contractFile = readFileSync(resolve(ROOT, "src/lib/db/database-contract.ts"), "utf8");
const indexFile = readFileSync(resolve(ROOT, "src/lib/agents/index.ts"), "utf8");
const obsFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-observability-types.ts"), "utf8");
const docsFile = existsSync(resolve(ROOT, "docs/agent-controlled-pmo-governance-intelligence-dashboard.md"))
  ? readFileSync(resolve(ROOT, "docs/agent-controlled-pmo-governance-intelligence-dashboard.md"), "utf8")
  : "";

const {
  validateAgentPmoGovernanceDashboardSnapshotStatus,
  validateAgentPmoGovernanceInsightCardType,
  validateAgentPmoGovernanceInsightSeverity,
  validateAgentPmoGovernanceInsightStatus,
  validateAgentPmoGovernanceTrendDirection,
  validateAgentPmoGovernanceActionability,
  validateAgentPmoGovernanceFeedbackQueueStatus,
  validateAgentPmoPolicyProposalType,
  validateAgentPmoPolicyProposalStatus,
  validateAgentPmoPolicyProposalDecision,
  validateAgentPmoGovernanceReportExportFormat,
  validateAgentPmoGovernanceReportExportStatus,
  validateAgentPmoGovernanceDashboardEventType,
  assertGovernanceDashboardPayloadSerializable,
  redactGovernanceDashboardPayload,
  sanitizeGovernanceDashboardText,
  normalizeCreateGovernanceDashboardSnapshotInput,
  normalizeCreatePmoPolicyProposalInput,
  normalizeReviewPmoPolicyProposalInput,
  normalizeGenerateGovernanceReportExportInput,
  dedupeGovernanceDashboardStrings,
  deriveGovernanceInsightSeverity,
  deriveGovernanceActionability,
  validateGovernanceReportExportSafety,
} = await import("../src/lib/agents/agent-pmo-governance-dashboard-validation.ts");

const {
  _clearDashboardStores,
  createGovernanceDashboardSnapshot,
  listGovernanceDashboardSnapshots,
  getGovernanceDashboardSnapshotById,
  createGovernanceInsightCard,
  listGovernanceInsightCards,
  updateGovernanceInsightCardStatus,
  createRiskCalibrationInsight,
  listRiskCalibrationInsights,
  createEvidenceQualityInsight,
  listEvidenceQualityInsights,
  createAdapterPerformanceInsight,
  listAdapterPerformanceInsights,
  createReviewRoutingInsight,
  listReviewRoutingInsights,
  createFeedbackQueueItem,
  listFeedbackQueueItems,
  updateFeedbackQueueItemStatus,
  createPolicyProposal,
  listPolicyProposals,
  recordPolicyProposalReview,
  createReportExport,
  getReportExportById,
  listReportExports,
  recordDashboardEvent,
  listDashboardEvents,
} = await import("../src/lib/agents/agent-pmo-governance-dashboard-registry.ts");

const {
  generatePmoGovernanceDashboardSnapshot,
  generatePmoGovernanceInsightCards,
  generatePmoRiskCalibrationInsights,
  generatePmoEvidenceQualityInsights,
  generatePmoAdapterPerformanceInsights,
  generatePmoReviewRoutingInsights,
  buildPmoGovernanceFeedbackQueue,
  reviewPmoGovernanceFeedbackQueueItem,
  createPmoPolicyProposalFromFeedback,
  reviewPmoPolicyProposal,
  generatePmoGovernanceReportExport,
  downloadPmoGovernanceReportExport,
  buildPmoGovernanceDashboardSummary,
  getPmoGovernanceDashboardData,
} = await import("../src/lib/agents/agent-pmo-governance-dashboard-service.ts");

// ─── Type/Model Tests ─────────────────────────────────────────────────────────

test("snapshot statuses include created, active, archived", () => {
  assert.ok(validateAgentPmoGovernanceDashboardSnapshotStatus("created"));
  assert.ok(validateAgentPmoGovernanceDashboardSnapshotStatus("active"));
  assert.ok(validateAgentPmoGovernanceDashboardSnapshotStatus("archived"));
  assert.ok(!validateAgentPmoGovernanceDashboardSnapshotStatus("invalid"));
});

test("insight card types include all required values", () => {
  const types = [
    "risk_calibration","evidence_quality","adapter_performance","review_routing",
    "governance_feedback","privacy_health","learning_signal_volume","policy_proposal","workspace_summary",
  ];
  for (const t of types) assert.ok(validateAgentPmoGovernanceInsightCardType(t), `missing: ${t}`);
  assert.ok(!validateAgentPmoGovernanceInsightCardType("unknown_type"));
});

test("insight severities include info, low, medium, high, critical", () => {
  for (const s of ["info","low","medium","high","critical"]) {
    assert.ok(validateAgentPmoGovernanceInsightSeverity(s));
  }
  assert.ok(!validateAgentPmoGovernanceInsightSeverity("ultra"));
});

test("insight statuses include created, open, reviewed, archived", () => {
  for (const s of ["created","open","reviewed","archived"]) {
    assert.ok(validateAgentPmoGovernanceInsightStatus(s));
  }
});

test("actionability values include all required", () => {
  for (const a of ["informational","review_recommended","proposal_recommended","pmo_attention_required"]) {
    assert.ok(validateAgentPmoGovernanceActionability(a));
  }
});

test("feedback queue statuses include open, reviewed, accepted, rejected, archived", () => {
  for (const s of ["open","reviewed","accepted","rejected","archived"]) {
    assert.ok(validateAgentPmoGovernanceFeedbackQueueStatus(s));
  }
});

test("policy proposal types include required values", () => {
  for (const t of ["risk_policy","evidence_requirement","adapter_quality_review","review_routing","human_review_policy","triage_policy","governance_process"]) {
    assert.ok(validateAgentPmoPolicyProposalType(t));
  }
});

test("policy proposal statuses include all required", () => {
  for (const s of ["created","open","under_review","approved_for_future_implementation","rejected","archived"]) {
    assert.ok(validateAgentPmoPolicyProposalStatus(s));
  }
});

test("report export formats include markdown, json, csv", () => {
  for (const f of ["markdown","json","csv"]) {
    assert.ok(validateAgentPmoGovernanceReportExportFormat(f));
  }
  assert.ok(!validateAgentPmoGovernanceReportExportFormat("xml"));
});

test("event types include required dashboard events", () => {
  for (const e of [
    "dashboard_snapshot_created","insight_card_created","governance_feedback_reviewed",
    "policy_proposal_created","policy_proposal_reviewed","governance_report_export_created",
    "governance_report_export_downloaded","dashboard_filter_applied","dashboard_summary_viewed",
  ]) {
    assert.ok(validateAgentPmoGovernanceDashboardEventType(e), `missing: ${e}`);
  }
});

// ─── Validation Tests ─────────────────────────────────────────────────────────

test("valid snapshot input normalizes", () => {
  const result = normalizeCreateGovernanceDashboardSnapshotInput({
    workspaceId: "ws-1",
    periodStart: "2026-08-01T00:00:00.000Z",
    periodEnd: "2026-08-31T23:59:59.999Z",
  });
  assert.equal(result.workspaceId, "ws-1");
});

test("missing workspaceId rejects in snapshot input", () => {
  assert.throws(() => normalizeCreateGovernanceDashboardSnapshotInput({
    workspaceId: "",
    periodStart: "2026-08-01T00:00:00.000Z",
    periodEnd: "2026-08-31T23:59:59.999Z",
  }));
});

test("periodEnd before periodStart rejects", () => {
  assert.throws(() => normalizeCreateGovernanceDashboardSnapshotInput({
    workspaceId: "ws-1",
    periodStart: "2026-08-31T00:00:00.000Z",
    periodEnd: "2026-08-01T00:00:00.000Z",
  }));
});

test("invalid card type rejects", () => {
  assert.ok(!validateAgentPmoGovernanceInsightCardType("not_a_type"));
});

test("invalid severity rejects", () => {
  assert.ok(!validateAgentPmoGovernanceInsightSeverity("extreme"));
});

test("invalid feedback queue status rejects", () => {
  assert.ok(!validateAgentPmoGovernanceFeedbackQueueStatus("pending"));
});

test("invalid policy proposal decision rejects", () => {
  assert.ok(!validateAgentPmoPolicyProposalDecision("apply_now"));
});

test("invalid export format rejects", () => {
  assert.ok(!validateAgentPmoGovernanceReportExportFormat("pdf"));
});

test("long title is sanitized", () => {
  const long = "A".repeat(300);
  const result = sanitizeGovernanceDashboardText(long, 160);
  assert.ok(result.length <= 160);
});

test("long summary is sanitized", () => {
  const long = "B".repeat(1000);
  const result = sanitizeGovernanceDashboardText(long, 600);
  assert.ok(result.length <= 600);
});

test("blocked field names are removed from dashboard payload", () => {
  const payload = {
    cardType: "risk_calibration",
    password: "secret123",
    rationale: "some text",
    failureMessage: "error",
    token: "abc",
  };
  const result = redactGovernanceDashboardPayload(payload);
  assert.ok(!("password" in result));
  assert.ok(!("rationale" in result));
  assert.ok(!("failureMessage" in result));
  assert.ok(!("token" in result));
  assert.ok("cardType" in result);
});

test("export safety check blocks raw payload field", () => {
  const result = validateGovernanceReportExportSafety({
    contentText: "some report with raw_payload included",
  });
  assert.ok(!result.safe || result.blockedReasons.length > 0);
});

test("export safety check blocks outcomePayload", () => {
  const result = validateGovernanceReportExportSafety({
    contentText: "report content outcomePayload data here",
  });
  assert.ok(!result.safe || result.blockedReasons.length > 0);
});

test("export safety check blocks intendedSummary", () => {
  const result = validateGovernanceReportExportSafety({
    contentText: "report with intendedSummary field",
  });
  assert.ok(!result.safe || result.blockedReasons.length > 0);
});

test("export safety check blocks token field", () => {
  const result = validateGovernanceReportExportSafety({
    contentJson: { token: "abc123", data: "safe" },
  });
  assert.ok(!result.safe || result.blockedReasons.length > 0);
});

test("export safety check passes safe content", () => {
  const result = validateGovernanceReportExportSafety({
    contentText: "PMO Governance Report: Risk calibration signals reviewed. No issues found.",
  });
  assert.ok(result.safe);
  assert.equal(result.blockedReasons.length, 0);
});

test("source ids deduplicate", () => {
  const result = dedupeGovernanceDashboardStrings(["a","b","a","c","b"]);
  assert.deepEqual(result, ["a","b","c"]);
});

test("governance actionability is deterministic", () => {
  const a = deriveGovernanceActionability({ severity: "critical", cardType: "risk_calibration" });
  const b = deriveGovernanceActionability({ severity: "critical", cardType: "risk_calibration" });
  assert.equal(a, b);
});

test("governance severity is deterministic", () => {
  const a = deriveGovernanceInsightSeverity({ cardType: "risk_calibration", metricValue: 10, trendDirection: "worsening", sourceCount: 5 });
  const b = deriveGovernanceInsightSeverity({ cardType: "risk_calibration", metricValue: 10, trendDirection: "worsening", sourceCount: 5 });
  assert.equal(a, b);
});

// ─── Migration Tests ──────────────────────────────────────────────────────────

test("migration creates agent_pmo_governance_dashboard_snapshots table", () => {
  assert.ok(migrationFile.includes("agent_pmo_governance_dashboard_snapshots"));
});

test("migration creates agent_pmo_governance_insight_cards table", () => {
  assert.ok(migrationFile.includes("agent_pmo_governance_insight_cards"));
});

test("migration creates agent_pmo_risk_calibration_insights table", () => {
  assert.ok(migrationFile.includes("agent_pmo_risk_calibration_insights"));
});

test("migration creates agent_pmo_evidence_quality_insights table", () => {
  assert.ok(migrationFile.includes("agent_pmo_evidence_quality_insights"));
});

test("migration creates agent_pmo_adapter_performance_insights table", () => {
  assert.ok(migrationFile.includes("agent_pmo_adapter_performance_insights"));
});

test("migration creates agent_pmo_review_routing_insights table", () => {
  assert.ok(migrationFile.includes("agent_pmo_review_routing_insights"));
});

test("migration creates agent_pmo_governance_feedback_queue table", () => {
  assert.ok(migrationFile.includes("agent_pmo_governance_feedback_queue"));
});

test("migration creates agent_pmo_policy_proposals table", () => {
  assert.ok(migrationFile.includes("agent_pmo_policy_proposals"));
});

test("migration creates agent_pmo_governance_report_exports table", () => {
  assert.ok(migrationFile.includes("agent_pmo_governance_report_exports"));
});

test("migration creates agent_pmo_governance_dashboard_events table", () => {
  assert.ok(migrationFile.includes("agent_pmo_governance_dashboard_events"));
});

test("migration enables RLS on dashboard tables", () => {
  assert.ok(migrationFile.includes("enable row level security") || migrationFile.includes("ENABLE ROW LEVEL SECURITY"));
});

test("migration creates indexes", () => {
  assert.ok(migrationFile.includes("create index") || migrationFile.includes("CREATE INDEX"));
});

test("migration references workspaces", () => {
  assert.ok(migrationFile.includes("workspaces"));
});

test("migration does not use unrestricted true policies", () => {
  const policyLines = migrationFile.split("\n").filter(l => l.includes("using (true)") || l.includes("USING (true)"));
  assert.equal(policyLines.length, 0, "Should not use unrestricted 'using (true)' policies");
});

// ─── Database Contract Tests ──────────────────────────────────────────────────

test("contract includes AgentPmoGovernanceDashboardSnapshotRow", () => {
  assert.ok(contractFile.includes("AgentPmoGovernanceDashboardSnapshotRow"));
});

test("contract includes AgentPmoGovernanceInsightCardRow", () => {
  assert.ok(contractFile.includes("AgentPmoGovernanceInsightCardRow"));
});

test("contract includes AgentPmoRiskCalibrationInsightRow", () => {
  assert.ok(contractFile.includes("AgentPmoRiskCalibrationInsightRow"));
});

test("contract includes AgentPmoEvidenceQualityInsightRow", () => {
  assert.ok(contractFile.includes("AgentPmoEvidenceQualityInsightRow"));
});

test("contract includes AgentPmoAdapterPerformanceInsightRow", () => {
  assert.ok(contractFile.includes("AgentPmoAdapterPerformanceInsightRow"));
});

test("contract includes AgentPmoReviewRoutingInsightRow", () => {
  assert.ok(contractFile.includes("AgentPmoReviewRoutingInsightRow"));
});

test("contract includes AgentPmoGovernanceFeedbackQueueRow", () => {
  assert.ok(contractFile.includes("AgentPmoGovernanceFeedbackQueueRow"));
});

test("contract includes AgentPmoPolicyProposalRow", () => {
  assert.ok(contractFile.includes("AgentPmoPolicyProposalRow"));
});

test("contract includes AgentPmoGovernanceReportExportRow", () => {
  assert.ok(contractFile.includes("AgentPmoGovernanceReportExportRow"));
});

test("contract includes AgentPmoGovernanceDashboardEventRow", () => {
  assert.ok(contractFile.includes("AgentPmoGovernanceDashboardEventRow"));
});

test("contract includes dashboard column arrays", () => {
  assert.ok(contractFile.includes("AGENT_PMO_GOVERNANCE_DASHBOARD_SNAPSHOT_COLUMNS"));
  assert.ok(contractFile.includes("AGENT_PMO_GOVERNANCE_INSIGHT_CARD_COLUMNS"));
});

test("contract version string updated", () => {
  assert.ok(contractFile.includes("controlled-pmo-governance-intelligence-dashboard"));
});

// ─── Registry Tests ───────────────────────────────────────────────────────────

test("registry exports createGovernanceDashboardSnapshot", () => {
  assert.equal(typeof createGovernanceDashboardSnapshot, "function");
});

test("registry exports listGovernanceDashboardSnapshots", () => {
  assert.equal(typeof listGovernanceDashboardSnapshots, "function");
});

test("registry exports createGovernanceInsightCard", () => {
  assert.equal(typeof createGovernanceInsightCard, "function");
});

test("registry exports listGovernanceInsightCards", () => {
  assert.equal(typeof listGovernanceInsightCards, "function");
});

test("registry exports updateGovernanceInsightCardStatus", () => {
  assert.equal(typeof updateGovernanceInsightCardStatus, "function");
});

test("registry exports createRiskCalibrationInsight", () => {
  assert.equal(typeof createRiskCalibrationInsight, "function");
});

test("registry exports createEvidenceQualityInsight", () => {
  assert.equal(typeof createEvidenceQualityInsight, "function");
});

test("registry exports createAdapterPerformanceInsight", () => {
  assert.equal(typeof createAdapterPerformanceInsight, "function");
});

test("registry exports createReviewRoutingInsight", () => {
  assert.equal(typeof createReviewRoutingInsight, "function");
});

test("registry exports createFeedbackQueueItem", () => {
  assert.equal(typeof createFeedbackQueueItem, "function");
});

test("registry exports updateFeedbackQueueItemStatus", () => {
  assert.equal(typeof updateFeedbackQueueItemStatus, "function");
});

test("registry exports createPolicyProposal", () => {
  assert.equal(typeof createPolicyProposal, "function");
});

test("registry exports recordPolicyProposalReview", () => {
  assert.equal(typeof recordPolicyProposalReview, "function");
});

test("registry exports createReportExport", () => {
  assert.equal(typeof createReportExport, "function");
});

test("registry exports listReportExports", () => {
  assert.equal(typeof listReportExports, "function");
});

test("registry exports recordDashboardEvent", () => {
  assert.equal(typeof recordDashboardEvent, "function");
});

test("registry exports listDashboardEvents", () => {
  assert.equal(typeof listDashboardEvents, "function");
});

test("snapshots are append-only (persisted after store operations)", async () => {
  _clearDashboardStores();
  const snap = await createGovernanceDashboardSnapshot({
    workspaceId: "ws-test",
    periodStart: "2026-08-01T00:00:00.000Z",
    periodEnd: "2026-08-31T23:59:59.999Z",
  });
  const snaps = await listGovernanceDashboardSnapshots("ws-test");
  assert.ok(snaps.some(s => s.id === snap.id));
});

test("events are append-only", async () => {
  _clearDashboardStores();
  await recordDashboardEvent({ workspaceId: "ws-ev", eventType: "dashboard_summary_viewed" });
  await recordDashboardEvent({ workspaceId: "ws-ev", eventType: "dashboard_filter_applied" });
  const events = await listDashboardEvents({ workspaceId: "ws-ev" });
  assert.ok(events.length >= 2);
});

test("proposals are not applied automatically", () => {
  assert.ok(!registryFile.includes("applyPolicy"));
  assert.ok(!registryFile.includes("mutatePolicy"));
  assert.ok(!registryFile.includes("updatePolicy"));
});

// ─── Service Tests ────────────────────────────────────────────────────────────

test("service exports generatePmoGovernanceDashboardSnapshot", () => {
  assert.equal(typeof generatePmoGovernanceDashboardSnapshot, "function");
});

test("service exports generatePmoGovernanceInsightCards", () => {
  assert.equal(typeof generatePmoGovernanceInsightCards, "function");
});

test("service exports generatePmoRiskCalibrationInsights", () => {
  assert.equal(typeof generatePmoRiskCalibrationInsights, "function");
});

test("service exports generatePmoEvidenceQualityInsights", () => {
  assert.equal(typeof generatePmoEvidenceQualityInsights, "function");
});

test("service exports generatePmoAdapterPerformanceInsights", () => {
  assert.equal(typeof generatePmoAdapterPerformanceInsights, "function");
});

test("service exports generatePmoReviewRoutingInsights", () => {
  assert.equal(typeof generatePmoReviewRoutingInsights, "function");
});

test("service exports buildPmoGovernanceFeedbackQueue", () => {
  assert.equal(typeof buildPmoGovernanceFeedbackQueue, "function");
});

test("service exports reviewPmoGovernanceFeedbackQueueItem", () => {
  assert.equal(typeof reviewPmoGovernanceFeedbackQueueItem, "function");
});

test("service exports createPmoPolicyProposalFromFeedback", () => {
  assert.equal(typeof createPmoPolicyProposalFromFeedback, "function");
});

test("service exports reviewPmoPolicyProposal", () => {
  assert.equal(typeof reviewPmoPolicyProposal, "function");
});

test("service exports generatePmoGovernanceReportExport", () => {
  assert.equal(typeof generatePmoGovernanceReportExport, "function");
});

test("service exports buildPmoGovernanceDashboardSummary", () => {
  assert.equal(typeof buildPmoGovernanceDashboardSummary, "function");
});

test("service exports getPmoGovernanceDashboardData", () => {
  assert.equal(typeof getPmoGovernanceDashboardData, "function");
});

test("service does not call LLM providers", () => {
  assert.ok(!serviceFile.includes("openai"));
  assert.ok(!serviceFile.includes("anthropic"));
  assert.ok(!serviceFile.includes("gemini"));
  assert.ok(!serviceFile.includes("embedding"));
});

test("service does not call external APIs directly", () => {
  assert.ok(!serviceFile.includes('fetch("http'));
  assert.ok(!serviceFile.includes('fetch("https'));
});

test("service does not send communications", () => {
  assert.ok(!serviceFile.includes("sendEmail"));
  assert.ok(!serviceFile.includes("send_email"));
  assert.ok(!serviceFile.includes("sendSlack"));
});

test("service does not mutate projects", () => {
  assert.ok(!serviceFile.includes("updateProject"));
  assert.ok(!serviceFile.includes("mutateProject"));
});

test("service does not execute adapters", () => {
  assert.ok(!serviceFile.includes("executeAdapter"));
  assert.ok(!serviceFile.includes("runAdapter"));
  assert.ok(!serviceFile.includes("dispatchExecutionToAdapter"));
});

test("service does not apply policies", () => {
  assert.ok(!serviceFile.includes("applyPolicy"));
  assert.ok(!serviceFile.includes("mutatePolicy"));
});

test("service does not change routing", () => {
  assert.ok(!serviceFile.includes("updateRouting"));
  assert.ok(!serviceFile.includes("changeRouting"));
});

test("service does not train models", () => {
  assert.ok(!serviceFile.includes("trainModel"));
  assert.ok(!serviceFile.includes("fine-tune"));
  assert.ok(!serviceFile.includes("finetune"));
});

test("report export safety validation blocks raw payload text", () => {
  const result = validateGovernanceReportExportSafety({
    contentText: "report data with raw_payload stored here",
  });
  assert.ok(!result.safe || result.blockedReasons.length > 0);
});

test("report export safety validation blocks secret keys in json", () => {
  const result = validateGovernanceReportExportSafety({
    contentJson: { secret: "xyz", report: "data" },
  });
  assert.ok(!result.safe || result.blockedReasons.length > 0);
});

test("dashboard summary is deterministic", async () => {
  _clearDashboardStores();
  const summary1 = await buildPmoGovernanceDashboardSummary("ws-det");
  const summary2 = await buildPmoGovernanceDashboardSummary("ws-det");
  assert.deepEqual(summary1, summary2);
});

test("snapshot generation does not call AI", () => {
  assert.ok(!serviceFile.includes("openai"));
  assert.ok(!serviceFile.includes("anthropic"));
  assert.ok(!serviceFile.includes("createEmbedding"));
});

test("policy proposal approval does not apply policy", () => {
  assert.ok(!serviceFile.includes("applyPolicy"));
  assert.ok(!serviceFile.includes("policy_applied"));
  assert.ok(!serviceFile.includes("policyApplied"));
});

// ─── Functional Service Tests ─────────────────────────────────────────────────

test("generatePmoGovernanceDashboardSnapshot returns snapshot record", async () => {
  _clearDashboardStores();
  const snap = await generatePmoGovernanceDashboardSnapshot({
    workspaceId: "ws-func",
    periodStart: "2026-08-01T00:00:00.000Z",
    periodEnd: "2026-08-31T23:59:59.999Z",
  });
  assert.ok(snap.id);
  assert.equal(snap.workspaceId, "ws-func");
  assert.equal(snap.status, "active");
});

test("generatePmoGovernanceInsightCards returns array of cards", async () => {
  _clearDashboardStores();
  const cards = await generatePmoGovernanceInsightCards({ workspaceId: "ws-cards" });
  assert.ok(Array.isArray(cards));
});

test("generatePmoRiskCalibrationInsights returns array", async () => {
  _clearDashboardStores();
  const insights = await generatePmoRiskCalibrationInsights({ workspaceId: "ws-risk" });
  assert.ok(Array.isArray(insights));
});

test("generatePmoEvidenceQualityInsights returns array", async () => {
  _clearDashboardStores();
  const insights = await generatePmoEvidenceQualityInsights({ workspaceId: "ws-ev" });
  assert.ok(Array.isArray(insights));
});

test("generatePmoAdapterPerformanceInsights returns array", async () => {
  _clearDashboardStores();
  const insights = await generatePmoAdapterPerformanceInsights({ workspaceId: "ws-adp" });
  assert.ok(Array.isArray(insights));
});

test("generatePmoReviewRoutingInsights returns array", async () => {
  _clearDashboardStores();
  const insights = await generatePmoReviewRoutingInsights({ workspaceId: "ws-rr" });
  assert.ok(Array.isArray(insights));
});

test("buildPmoGovernanceFeedbackQueue returns array", async () => {
  _clearDashboardStores();
  const queue = await buildPmoGovernanceFeedbackQueue({ workspaceId: "ws-fbq" });
  assert.ok(Array.isArray(queue));
});

test("reviewPmoGovernanceFeedbackQueueItem updates status", async () => {
  _clearDashboardStores();
  const item = await createFeedbackQueueItem({
    workspaceId: "ws-rev",
    feedbackId: "fb-1",
    feedbackType: "risk_calibration",
    feedbackCategory: "risk_calibration",
    severity: "medium",
    recommendation: "Review risk posture.",
    sourceSignalCount: 3,
  });
  const updated = await reviewPmoGovernanceFeedbackQueueItem({
    workspaceId: "ws-rev",
    queueItemId: item.id,
    status: "reviewed",
    reviewRationale: "PMO reviewed.",
  });
  assert.equal(updated.status, "reviewed");
});

test("createPmoPolicyProposalFromFeedback does not apply policy", async () => {
  _clearDashboardStores();
  const proposal = await createPmoPolicyProposalFromFeedback({
    workspaceId: "ws-prop",
    feedbackId: "fb-2",
    proposalCategory: "risk_calibration",
    recommendation: "Consider tightening risk review.",
    feedbackType: "risk_calibration",
  });
  assert.ok(proposal.id);
  assert.ok(["created","open"].includes(proposal.status));
  assert.ok(!proposal.proposedChangeSummary.toLowerCase().includes("applied"));
});

test("reviewPmoPolicyProposal with approved_for_future_implementation does not apply policy", async () => {
  _clearDashboardStores();
  const proposal = await createPolicyProposal({
    workspaceId: "ws-rev-prop",
    proposalType: "risk_policy",
    proposalCategory: "risk_calibration",
    proposedChangeSummary: "Increase review for high-risk adapters.",
    riskLevel: "medium",
  });
  const reviewed = await reviewPmoPolicyProposal({
    workspaceId: "ws-rev-prop",
    proposalId: proposal.id,
    decision: "approve_for_future_implementation",
    reviewRationale: "Approved as backlog candidate only.",
  });
  assert.equal(reviewed.status, "approved_for_future_implementation");
  assert.equal(reviewed.reviewDecision, "approve_for_future_implementation");
});

test("getPmoGovernanceDashboardData returns complete shape", async () => {
  _clearDashboardStores();
  const data = await getPmoGovernanceDashboardData({ workspaceId: "ws-data" });
  assert.ok("snapshot" in data || data.snapshot === null);
  assert.ok(Array.isArray(data.cards));
  assert.ok(Array.isArray(data.riskCalibration));
  assert.ok(Array.isArray(data.evidenceQuality));
  assert.ok(Array.isArray(data.adapterPerformance));
  assert.ok(Array.isArray(data.reviewRouting));
  assert.ok(Array.isArray(data.feedbackQueue));
  assert.ok(Array.isArray(data.policyProposals));
  assert.ok(Array.isArray(data.reportExports));
  assert.ok(typeof data.summary === "object");
});

test("generatePmoGovernanceReportExport returns export record", async () => {
  _clearDashboardStores();
  const exportRecord = await generatePmoGovernanceReportExport({
    workspaceId: "ws-export",
    periodStart: "2026-08-01T00:00:00.000Z",
    periodEnd: "2026-08-31T23:59:59.999Z",
    exportFormat: "markdown",
  });
  assert.ok(exportRecord.id);
  assert.ok(["created","generated"].includes(exportRecord.status));
});

// ─── API Route Tests ──────────────────────────────────────────────────────────

const routeBase = resolve(ROOT, "src/app/api/agents/execution/governance-dashboard");

test("snapshots POST/GET route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "snapshots/route.ts")));
});

test("snapshot detail route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "snapshots/[snapshotId]/route.ts")));
});

test("cards POST/GET route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "cards/route.ts")));
});

test("card status route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "cards/[cardId]/status/route.ts")));
});

test("risk calibration route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "risk-calibration/route.ts")));
});

test("evidence quality route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "evidence-quality/route.ts")));
});

test("adapter performance route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "adapter-performance/route.ts")));
});

test("review routing route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "review-routing/route.ts")));
});

test("feedback queue routes exist", () => {
  assert.ok(existsSync(resolve(routeBase, "feedback-queue/route.ts")));
  assert.ok(existsSync(resolve(routeBase, "feedback-queue/[queueItemId]/review/route.ts")));
});

test("policy proposal routes exist", () => {
  assert.ok(existsSync(resolve(routeBase, "policy-proposals/route.ts")));
  assert.ok(existsSync(resolve(routeBase, "policy-proposals/from-feedback/route.ts")));
  assert.ok(existsSync(resolve(routeBase, "policy-proposals/[proposalId]/review/route.ts")));
});

test("export routes exist", () => {
  assert.ok(existsSync(resolve(routeBase, "exports/route.ts")));
  assert.ok(existsSync(resolve(routeBase, "exports/[exportId]/route.ts")));
  assert.ok(existsSync(resolve(routeBase, "exports/[exportId]/download/route.ts")));
});

test("summary route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "summary/route.ts")));
});

test("data route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "data/route.ts")));
});

test("events route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "events/route.ts")));
});

// Verify route files don't contain prohibited calls
const routeFiles = [
  "snapshots/route.ts",
  "cards/route.ts",
  "feedback-queue/route.ts",
  "policy-proposals/route.ts",
  "exports/route.ts",
  "summary/route.ts",
  "data/route.ts",
].map(f => {
  try {
    return readFileSync(resolve(routeBase, f), "utf8");
  } catch {
    return "";
  }
}).join("\n");

test("route files do not call LLM providers", () => {
  assert.ok(!routeFiles.includes("openai"));
  assert.ok(!routeFiles.includes("anthropic"));
  assert.ok(!routeFiles.includes("gemini"));
});

test("route files do not send communications", () => {
  assert.ok(!routeFiles.includes("sendEmail"));
  assert.ok(!routeFiles.includes("sendSlack"));
});

test("route files do not apply policies", () => {
  assert.ok(!routeFiles.includes("applyPolicy"));
  assert.ok(!routeFiles.includes("mutatePolicy"));
});

// ─── Observability Tests ──────────────────────────────────────────────────────

test("observability types include PMO governance dashboard source", () => {
  assert.ok(obsFile.includes("agent_controlled_pmo_governance_intelligence_dashboard"));
});

test("observability types include PMO governance dashboard event types", () => {
  assert.ok(obsFile.includes("pmo_governance_dashboard_snapshot_created"));
  assert.ok(obsFile.includes("pmo_governance_insight_card_created"));
  assert.ok(obsFile.includes("pmo_governance_policy_proposal_created"));
  assert.ok(obsFile.includes("pmo_governance_report_export_created"));
});

// ─── Terminology Tests ────────────────────────────────────────────────────────

const BAD_PATTERN = /[Ff]ucker/;

const newFiles = [
  typesFile, validationFile, registryFile, serviceFile,
  migrationFile, contractFile, indexFile, docsFile,
];

test("no informal internal sprint nickname in added source files", () => {
  for (const f of newFiles) {
    assert.ok(!BAD_PATTERN.test(f), "Informal terminology found in a new file");
  }
});

// ─── Regression Tests ─────────────────────────────────────────────────────────

test("learning types file still exists", () => {
  assert.ok(existsSync(resolve(ROOT, "src/lib/agents/agent-execution-learning-types.ts")));
});

test("learning registry file still exists", () => {
  assert.ok(existsSync(resolve(ROOT, "src/lib/agents/agent-execution-learning-registry.ts")));
});

test("learning service file still exists", () => {
  assert.ok(existsSync(resolve(ROOT, "src/lib/agents/agent-execution-learning-service.ts")));
});

test("prior learning migration still exists", () => {
  assert.ok(existsSync(resolve(ROOT, "supabase/migrations/20260806000000_agent_controlled_execution_learning_signals_governance_feedback_loop.sql")));
});
