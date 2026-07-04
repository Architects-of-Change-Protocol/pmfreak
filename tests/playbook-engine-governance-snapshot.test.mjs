import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const snapshotEngine = fs.readFileSync("src/lib/playbook-engine/governance-snapshot-engine.ts", "utf8");
const snapshotTypes = fs.readFileSync("src/lib/playbook-engine/governance-snapshot-types.ts", "utf8");
const demoScenarios = fs.readFileSync("src/lib/playbook-engine/demo-scenarios.ts", "utf8");
const explainFile = fs.readFileSync("src/lib/playbook-engine/explain.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/playbook-engine/index.ts", "utf8");

// ─── Exports ──────────────────────────────────────────────────────────────────

test("governance snapshot engine functions are exported from the module", () => {
  for (const fn of ["generatePlaybookGovernanceSnapshot", "explainPlaybookGovernanceSnapshot"]) {
    assert.match(indexFile, new RegExp(fn), `index.ts must re-export ${fn}`);
    assert.match(snapshotEngine, new RegExp(`export function ${fn}`), `governance-snapshot-engine.ts must define ${fn}`);
  }
});

test("core governance snapshot types are exported from the module", () => {
  for (const typeName of ["PlaybookGovernanceSnapshot", "PlaybookGovernanceSnapshotExplanation", "PlaybookGovernanceApprovalItem"]) {
    assert.match(indexFile, new RegExp(typeName), `index.ts must re-export ${typeName}`);
    assert.match(snapshotTypes, new RegExp(`export type ${typeName}`), `governance-snapshot-types.ts must define ${typeName}`);
  }
});

test("demo scenarios module declares all four minimum scenarios", () => {
  for (const scenarioId of [
    "pending_reception_billing_blocker",
    "security_hardening_client_validation",
    "web_software_uat_evidence_pending",
    "ready_for_billing",
  ]) {
    assert.match(demoScenarios, new RegExp(scenarioId), `demo-scenarios.ts must declare scenario '${scenarioId}'`);
  }
  assert.match(indexFile, /PLAYBOOK_DEMO_SCENARIOS/);
  assert.match(indexFile, /generateDemoGovernanceSnapshot/);
});

test("governance snapshot engine never persists, sends, or executes anything", () => {
  assert.doesNotMatch(snapshotEngine, /supabase|createPlatformEvent\(|\.insert\(|sendEmail|nodemailer/i);
});

test("capability explanation mentions every MVP module", () => {
  for (const moduleLabel of [
    "Seed Playbook",
    "Rules Engine",
    "Project Constitution Generator",
    "Recommendation Engine",
    "Communications Playbook",
    "Operational Intelligence",
    "Closure & Billing Intelligence",
    "Audit Trail",
    "Governance Snapshot",
  ]) {
    assert.match(explainFile, new RegExp(moduleLabel), `explain.ts must mention '${moduleLabel}'`);
  }
});

test("capability explanation states no DB side effects, no automatic emails/closure/billing/approvals", () => {
  assert.match(explainFile, /escribe en base de datos/i);
  assert.match(explainFile, /env[ií]a correos/i);
  assert.match(explainFile, /cierra proyectos/i);
  assert.match(explainFile, /marca facturas/i);
  assert.match(explainFile, /aprueba autom[aá]ticamente/i);
});

// ─── Runtime behavior probe ──────────────────────────────────────────────────

const runtimeProbe = String.raw`
import assert from "node:assert/strict";
import {
  generatePlaybookGovernanceSnapshot,
  explainPlaybookGovernanceSnapshot,
  generateDemoGovernanceSnapshot,
  PLAYBOOK_DEMO_SCENARIOS,
} from "./src/lib/playbook-engine/index.ts";

// 1. Validation failures.
const invalid = generatePlaybookGovernanceSnapshot({ projectId: "", workspaceId: "w" });
assert.equal(invalid.ok, false);
assert.equal(invalid.failureClass, "validation_failed");

// 2. Scenario A: pending reception + billing blocker.
const a = generateDemoGovernanceSnapshot("pending_reception_billing_blocker");
assert.equal(a.ok, true);
assert.equal(a.data.closureBillingAssessment.readyForClosure, false);
assert.equal(a.data.closureBillingAssessment.readyForBilling, false);
assert.ok(a.data.closureBillingAssessment.billingBlockers.some((b) => b.type === "missing_reception"));
assert.ok(a.data.recommendations.length > 0);
assert.ok(
  a.data.communicationDrafts.some((d) => d.templateId === "reception_request" || d.templateId === "billing_enablement_follow_up"),
  "scenario A must recommend reception_request or billing_enablement_follow_up",
);
assert.ok(a.data.operationalDrafts.some((d) => d.type === "dependency"), "scenario A must generate at least a dependency operational draft");
assert.ok(a.data.auditEvents.length > 0);

// 3. Scenario B: security/hardening requiring client validation.
const b = generateDemoGovernanceSnapshot("security_hardening_client_validation");
assert.equal(b.ok, true);
assert.equal(b.data.closureBillingAssessment.readyForClosure, false);
assert.ok(b.data.closureBillingAssessment.billingBlockers.some((bl) => bl.type === "missing_validation"));
assert.ok(
  b.data.communicationDrafts.some((d) => d.templateId === "decision_request" || d.templateId === "information_request"),
  "scenario B must recommend decision_request or information_request",
);
assert.ok(b.data.missingEvidenceSummary.length >= 0);

// 4. Scenario C: web/software with UAT/evidence pending.
const c = generateDemoGovernanceSnapshot("web_software_uat_evidence_pending");
assert.equal(c.ok, true);
assert.ok(c.data.communicationDrafts.some((d) => d.templateId === "information_request"));
assert.ok(c.data.operationalDrafts.some((d) => d.type === "dependency" && d.dependencyType === "client"));
assert.equal(c.data.closureBillingAssessment.readyForClosure, false);
assert.equal(c.data.closureBillingAssessment.readyForBilling, false);
assert.ok(c.data.closureBillingAssessment.closureBlockers.some((bl) => bl.type === "missing_evidence"), "scenario C must surface a missing_evidence blocker from hasTechnicalEvidence=false");

// 5. Scenario D: ready for billing.
const d = generateDemoGovernanceSnapshot("ready_for_billing");
assert.equal(d.ok, true);
assert.equal(d.data.closureBillingAssessment.readyForBilling, true);
assert.equal(d.data.closureBillingAssessment.readyForClosure, true);
assert.ok(d.data.nextBestActions.some((na) => na.type === "start_internal_billing_process"));
assert.ok(!("invoiced" in d.data.closureBillingAssessment));

// 6. approvalRequiredSummary flags sensitive next actions even when ready.
assert.ok(d.data.approvalRequiredSummary.length > 0, "even a ready-for-billing snapshot must flag approval-required next actions");

// 7. missingEvidenceSummary is deduplicated.
const missingSet = new Set(c.data.missingEvidenceSummary);
assert.equal(missingSet.size, c.data.missingEvidenceSummary.length);

// 8. auditEvents is deduplicated by fingerprint.
const auditFpSet = new Set(a.data.auditEvents.map((e) => e.fingerprint));
assert.equal(auditFpSet.size, a.data.auditEvents.length);

// 9. Re-running the same scenario yields the same snapshot fingerprint (idempotent, no persistence).
const aAgain = generateDemoGovernanceSnapshot("pending_reception_billing_blocker");
assert.equal(a.data.fingerprint, aAgain.data.fingerprint);

// 10. explainPlaybookGovernanceSnapshot states nothing executed automatically.
const explanation = explainPlaybookGovernanceSnapshot(a.data);
assert.match(explanation.narrative, /no se ejecut[oó]|no se env[ií]|no se aprob[oó]/i);
assert.ok(explanation.rulesActivated.length > 0);
assert.ok(explanation.recommendationsGenerated.length > 0);

// 11. Every declared demo scenario runs successfully.
for (const scenarioId of Object.keys(PLAYBOOK_DEMO_SCENARIOS)) {
  const result = generateDemoGovernanceSnapshot(scenarioId);
  assert.equal(result.ok, true, "scenario '" + scenarioId + "' must generate successfully");
}

const payload = {
  scenarioCount: Object.keys(PLAYBOOK_DEMO_SCENARIOS).length,
  readyForBillingD: d.data.closureBillingAssessment.readyForBilling,
  auditEventCountA: a.data.auditEvents.length,
};
console.log(JSON.stringify(payload));
`;

const runtime = JSON.parse(execFileSync("npx", ["tsx", "--eval", runtimeProbe], { encoding: "utf8" }).trim().split("\n").at(-1));

test("governance snapshot runtime probe: all four demo scenarios are declared and runnable", () => {
  assert.equal(runtime.scenarioCount, 4);
});

test("governance snapshot runtime probe: ready-for-billing scenario reaches readyForBilling=true without invoicing", () => {
  assert.equal(runtime.readyForBillingD, true);
});

test("governance snapshot runtime probe: pending-reception scenario produces a non-empty audit trail", () => {
  assert.ok(runtime.auditEventCountA > 0);
});
