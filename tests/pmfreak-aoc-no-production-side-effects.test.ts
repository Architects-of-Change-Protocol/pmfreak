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
];

function listModuleFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && /\.ts$/.test(entry.name)) files.push(full);
    }
  };
  walk(MODULE_DIR);
  return files;
}

test("static scan confirms no action-execution or production side-effect APIs are used", () => {
  const files = listModuleFiles();
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

test("public exports include the full v1 required surface", () => {
  const requiredExportNames = [
    "PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_ID",
    "PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_NAME",
    "PMFREAK_AOC_GOVERNANCE_CLIENT_CAPABILITIES",
    "PMFREAK_AOC_GOVERNANCE_CLIENT_FORBIDDEN_OPERATIONS",
    "createPMFreakAocGovernanceRequestClientDescriptor",
    "createPMFreakAocGovernanceRequestClientConfig",
    "createPMFreakAocGovernanceRequest",
    "validatePMFreakAocGovernanceRequest",
    "createLocalMockPMFreakAocGovernanceTransport",
    "createUnsupportedRemotePMFreakAocGovernanceTransport",
    "createPMFreakAocGovernanceRequestClient",
    "createPMFreakAocGovernanceDecisionSummary",
    "isPMFreakAocGovernanceClientForbiddenOperation",
    "assertPMFreakAocGovernanceClientReadOnlyOperation",
    "redactPMFreakAocGovernancePayloadValue",
    "redactPMFreakAocGovernanceRequest",
    "redactPMFreakAocGovernanceResponse",
    "PMFreakAocGovernanceClientError",
    "createPMFreakAocGovernanceClientError",
    "createPMFreakAocGovernanceClientHealth",
    "evaluatePMFreakAocGovernanceClaimSafety",
    "assertNoPMFreakAocGovernanceOverclaim",
  ];

  const actualExports = Object.keys(PMFreakAocGovernanceRequestClientModule);
  for (const name of requiredExportNames) {
    assert.ok(actualExports.includes(name), `expected public export "${name}" to be present`);
  }
});

test("module never calls execution/mutation/writeback capabilities on itself", () => {
  const clientFile = fs.readFileSync(path.join(MODULE_DIR, "pmfreak-aoc-governance-client.ts"), "utf8");

  for (const forbidden of ["executeAction(", "applyDecision(", "mutateProject(", ".writebackDecision("]) {
    assert.ok(!clientFile.includes(forbidden));
  }
});
