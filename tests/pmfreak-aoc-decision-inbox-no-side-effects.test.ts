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

function listInboxFiles(): string[] {
  return fs
    .readdirSync(MODULE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith("pmfreak-aoc-decision-inbox") && entry.name.endsWith(".ts"))
    .map((entry) => path.join(MODULE_DIR, entry.name));
}

test("static scan confirms no action execution, mutation, writeback or communication/invoice code", () => {
  const files = listInboxFiles();
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

test("public exports include the full decision inbox v1 required surface", () => {
  const requiredExportNames = [
    "PMFREAK_AOC_DECISION_DISPLAY_INBOX_ID",
    "PMFREAK_AOC_DECISION_DISPLAY_INBOX_NAME",
    "PMFREAK_AOC_DECISION_DISPLAY_INBOX_VERSION",
    "PMFREAK_AOC_DECISION_INBOX_CAPABILITIES",
    "PMFREAK_AOC_DECISION_INBOX_FORBIDDEN_OPERATIONS",
    "createPMFreakAocDecisionInboxDescriptor",
    "createPMFreakAocDecisionInboxConfig",
    "createPMFreakAocDecisionInboxItemFromGovernanceResponse",
    "mapPMFreakAocDecisionToInboxStatus",
    "mapPMFreakAocDecisionToInboxCategory",
    "mapPMFreakAocDecisionToInboxSeverity",
    "createPMFreakAocDecisionInboxSafeNextStep",
    "createPMFreakAocDecisionInbox",
    "filterPMFreakAocDecisionInboxItems",
    "sortPMFreakAocDecisionInboxItems",
    "groupPMFreakAocDecisionInboxItems",
    "summarizePMFreakAocDecisionInboxItems",
    "createPMFreakAocDecisionInboxDetailViewModel",
    "createPMFreakAocDecisionInboxEmptyState",
    "createPMFreakAocDecisionInboxErrorState",
    "isPMFreakAocDecisionInboxForbiddenOperation",
    "assertPMFreakAocDecisionInboxDisplayOnlyOperation",
    "redactPMFreakAocDecisionInboxValue",
    "evaluatePMFreakAocDecisionInboxClaimSafety",
    "assertNoPMFreakAocDecisionInboxOverclaim",
  ];

  const actualExports = Object.keys(PMFreakAocGovernanceRequestClientModule);
  for (const name of requiredExportNames) {
    assert.ok(actualExports.includes(name), `expected public export "${name}" to be present`);
  }
});

test("decision inbox module never calls execution/mutation/writeback capabilities on itself", () => {
  const files = listInboxFiles();
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const forbidden of ["executeAction(", "applyDecision(", "mutateProject(", ".writebackDecision(", "sendEmail(", "postToSlack("]) {
      assert.ok(!content.includes(forbidden), `${path.relative(process.cwd(), file)} should not contain "${forbidden}"`);
    }
  }
});
