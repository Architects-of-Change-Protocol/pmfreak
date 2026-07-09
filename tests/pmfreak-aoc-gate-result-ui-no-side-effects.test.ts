import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import * as PMFreakAocGovernanceRequestClientModule from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const MODULE_DIR = path.resolve(process.cwd(), "src/features/pmfreak-integrations/aoc-governance-request-client");

const FORBIDDEN_SIDE_EFFECT_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "fs write", pattern: /\bfs\.(writeFile|appendFile|unlink|rm|mkdir)/ },
  { label: "child_process", pattern: /child_process/ },
  { label: "database client", pattern: /\b(supabase|prisma|pg\.Pool|mongoose)\b/i },
  { label: "outbound email", pattern: /\b(nodemailer|sendgrid|ses\.sendEmail)\b/i },
  { label: "Slack/Teams webhook", pattern: /\b(slack|teams)\b.*webhook/i },
  { label: "invoice creation call", pattern: /createInvoice\s*\(/ },
  { label: "decision writeback call", pattern: /writebackDecision\s*\(/ },
];

function listUIFiles(): string[] {
  return fs
    .readdirSync(MODULE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith("pmfreak-aoc-gate-result-ui") && entry.name.endsWith(".ts"))
    .map((entry) => path.join(MODULE_DIR, entry.name));
}

test("static scan confirms no action execution, mutation, writeback, communication or invoice creation code", () => {
  const files = listUIFiles();
  const violations: string[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const { label, pattern } of FORBIDDEN_SIDE_EFFECT_PATTERNS) {
      if (pattern.test(content)) {
        violations.push(`${path.relative(process.cwd(), file)}: ${label}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("gate result UI module never calls execution/mutation/writeback capabilities on itself", () => {
  const files = listUIFiles();
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const forbidden of ["executeAction(", "applyDecision(", "mutateProject(", ".writebackDecision(", "sendEmail(", "postToSlack(", "createInvoice("]) {
      assert.ok(!content.includes(forbidden), `${path.relative(process.cwd(), file)} should not contain "${forbidden}"`);
    }
  }
});

test("static scan confirms no enabled execution/mutation/invoice/communication buttons", () => {
  const files = listUIFiles();
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    assert.ok(!/showExecutionButtons:\s*true/.test(content));
    assert.ok(!/showMutationButtons:\s*true/.test(content));
    assert.ok(!/showInvoiceButtons:\s*true/.test(content));
    assert.ok(!/showCommunicationButtons:\s*true/.test(content));
  }
});

test("public exports include the full gate result UI v1 required surface", () => {
  const requiredExportNames = [
    "PMFREAK_AOC_GATE_RESULT_UI_ID",
    "PMFREAK_AOC_GATE_RESULT_UI_NAME",
    "PMFREAK_AOC_GATE_RESULT_UI_VERSION",
    "PMFREAK_AOC_GATE_RESULT_UI_CAPABILITIES",
    "PMFREAK_AOC_GATE_RESULT_UI_FORBIDDEN_OPERATIONS",
    "createPMFreakAocGateResultUIDescriptor",
    "createPMFreakAocGateResultUIConfig",
    "mapPMFreakAocGateVerdictToUILabel",
    "mapPMFreakAocGateVerdictToUITone",
    "createPMFreakAocGateResultUIBadge",
    "createPMFreakAocGateResultUIDisplayModel",
    "createPMFreakAocGateResultBannerViewModel",
    "createPMFreakAocGateResultCardViewModel",
    "createPMFreakAocGateResultDetailPanelViewModel",
    "createPMFreakAocGateResultBlockerViewModel",
    "createPMFreakAocGateRequirementListViewModel",
    "createPMFreakAocGateTraceViewModel",
    "createPMFreakAocGateSafetyDisclaimerViewModel",
    "createPMFreakAocGateResultUIActionHints",
    "createPMFreakAocGateResultUIEmptyState",
    "createPMFreakAocGateResultUIErrorState",
    "isPMFreakAocGateResultUIForbiddenActionOperation",
    "assertPMFreakAocGateResultUIDoesNotAct",
    "isPMFreakAocGateResultUIForbiddenMutationOperation",
    "assertPMFreakAocGateResultUIDoesNotMutate",
    "redactPMFreakAocGateResultUIValue",
    "evaluatePMFreakAocGateResultUIClaimSafety",
    "assertNoPMFreakAocGateResultUIOverclaim",
  ];

  const actualExports = Object.keys(PMFreakAocGovernanceRequestClientModule);
  for (const name of requiredExportNames) {
    assert.ok(actualExports.includes(name), `expected public export "${name}" to be present`);
  }
});

test("existing governance request client, remote transport, decision inbox and governed action gate exports are still present", () => {
  const actualExports = Object.keys(PMFreakAocGovernanceRequestClientModule);
  assert.ok(actualExports.includes("createPMFreakAocGovernanceRequestClient"));
  assert.ok(actualExports.includes("createRemoteHttpPMFreakAocGovernanceTransport"));
  assert.ok(actualExports.includes("createPMFreakAocDecisionInboxItemFromGovernanceResponse"));
  assert.ok(actualExports.includes("evaluatePMFreakAocGovernedActionGate"));
});
