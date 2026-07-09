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

function listGateFiles(): string[] {
  return fs
    .readdirSync(MODULE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith("pmfreak-aoc-governed-action-gate") && entry.name.endsWith(".ts"))
    .map((entry) => path.join(MODULE_DIR, entry.name));
}

test("static scan confirms no action execution, mutation, writeback or communication/invoice code", () => {
  const files = listGateFiles();
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

test("public exports include the full governed action gate v1 required surface", () => {
  const requiredExportNames = [
    "PMFREAK_AOC_GOVERNED_ACTION_GATE_ID",
    "PMFREAK_AOC_GOVERNED_ACTION_GATE_NAME",
    "PMFREAK_AOC_GOVERNED_ACTION_GATE_VERSION",
    "PMFREAK_AOC_GOVERNED_ACTION_GATE_CAPABILITIES",
    "PMFREAK_AOC_GOVERNED_ACTION_GATE_FORBIDDEN_OPERATIONS",
    "createPMFreakAocGovernedActionGateDescriptor",
    "createPMFreakAocGovernedActionGateConfig",
    "createPMFreakAocGovernedActionGateInput",
    "mapPMFreakAocDecisionToGateVerdict",
    "mapPMFreakAocGateVerdictToSeverity",
    "createPMFreakAocGateFlagsFromVerdict",
    "createPMFreakAocGateReasonCodes",
    "createPMFreakAocGateSafeNextStep",
    "evaluatePMFreakAocGovernedActionGateFromGovernanceResponse",
    "evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem",
    "evaluatePMFreakAocGovernedActionGate",
    "evaluatePMFreakAocGovernedActionAttemptGate",
    "createPMFreakAocGovernedActionGateTrace",
    "batchEvaluatePMFreakAocGovernedActionGateResults",
    "summarizePMFreakAocGovernedActionGateResults",
    "createPMFreakAocGovernedActionGateDetailViewModel",
    "isPMFreakAocGovernedActionGateForbiddenExecutionOperation",
    "assertPMFreakAocGovernedActionGateDoesNotExecute",
    "isPMFreakAocGovernedActionGateForbiddenMutationOperation",
    "assertPMFreakAocGovernedActionGateDoesNotMutate",
    "redactPMFreakAocGovernedActionGateValue",
    "evaluatePMFreakAocGovernedActionGateClaimSafety",
    "assertNoPMFreakAocGovernedActionGateOverclaim",
  ];

  const actualExports = Object.keys(PMFreakAocGovernanceRequestClientModule);
  for (const name of requiredExportNames) {
    assert.ok(actualExports.includes(name), `expected public export "${name}" to be present`);
  }
});

test("governed action gate module never calls execution/mutation/writeback capabilities on itself", () => {
  const files = listGateFiles();
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const forbidden of ["executeAction(", "applyDecision(", "mutateProject(", ".writebackDecision(", "sendEmail(", "postToSlack(", "createInvoice("]) {
      assert.ok(!content.includes(forbidden), `${path.relative(process.cwd(), file)} should not contain "${forbidden}"`);
    }
  }
});

test("existing governance request client, remote transport and decision inbox exports are still present", () => {
  const actualExports = Object.keys(PMFreakAocGovernanceRequestClientModule);
  assert.ok(actualExports.includes("createPMFreakAocGovernanceRequestClient"));
  assert.ok(actualExports.includes("createRemoteHttpPMFreakAocGovernanceTransport"));
  assert.ok(actualExports.includes("createPMFreakAocDecisionInboxItemFromGovernanceResponse"));
});
