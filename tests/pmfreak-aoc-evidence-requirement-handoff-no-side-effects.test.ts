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
  { label: "evidence attachment call", pattern: /attachEvidence\s*\(/ },
  { label: "task creation call", pattern: /createTask\s*\(/ },
];

function listHandoffFiles(): string[] {
  return fs
    .readdirSync(MODULE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith("pmfreak-aoc-evidence-requirement-handoff") && entry.name.endsWith(".ts"))
    .map((entry) => path.join(MODULE_DIR, entry.name));
}

test("static scan confirms no attachment, task creation, mutation, writeback or communication/invoice code", () => {
  const files = listHandoffFiles();
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

test("public exports include the full evidence requirement handoff v1 required surface", () => {
  const requiredExportNames = [
    "PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_ID",
    "PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_NAME",
    "PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_VERSION",
    "PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_CAPABILITIES",
    "PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_FORBIDDEN_OPERATIONS",
    "createPMFreakAocEvidenceRequirementHandoffDescriptor",
    "createPMFreakAocEvidenceRequirementHandoffConfig",
    "inferPMFreakAocEvidenceRequirementType",
    "extractPMFreakAocEvidenceRequirementReferences",
    "normalizePMFreakAocEvidenceRequirementHandoffContext",
    "mapPMFreakAocEvidenceRequirementPriority",
    "createPMFreakAocEvidenceRequirementHandoffSafeNextStep",
    "createPMFreakAocEvidenceRequirementHandoffFromGovernanceResponse",
    "createPMFreakAocEvidenceRequirementHandoffFromDecisionInboxItem",
    "createPMFreakAocEvidenceRequirementHandoffFromGateResult",
    "createPMFreakAocEvidenceRequirementHandoffFromGateResultUIDisplayModel",
    "createPMFreakAocEvidenceRequirementChecklistViewModel",
    "createPMFreakAocEvidenceRequirementReviewPacket",
    "createPMFreakAocEvidenceRequirementHandoffDetailViewModel",
    "summarizePMFreakAocEvidenceRequirementHandoffs",
    "batchCreatePMFreakAocEvidenceRequirementHandoffs",
    "createPMFreakAocEvidenceRequirementHandoffEmptyState",
    "createPMFreakAocEvidenceRequirementHandoffErrorState",
    "isPMFreakAocEvidenceRequirementHandoffForbiddenAttachmentOperation",
    "assertPMFreakAocEvidenceRequirementHandoffDoesNotAttachEvidence",
    "isPMFreakAocEvidenceRequirementHandoffForbiddenTaskOperation",
    "assertPMFreakAocEvidenceRequirementHandoffDoesNotCreateTasks",
    "isPMFreakAocEvidenceRequirementHandoffForbiddenMutationOperation",
    "assertPMFreakAocEvidenceRequirementHandoffDoesNotMutate",
    "isPMFreakAocEvidenceRequirementHandoffForbiddenCommunicationOperation",
    "assertPMFreakAocEvidenceRequirementHandoffDoesNotCommunicate",
    "redactPMFreakAocEvidenceRequirementHandoffValue",
    "evaluatePMFreakAocEvidenceRequirementHandoffClaimSafety",
    "assertNoPMFreakAocEvidenceRequirementHandoffOverclaim",
  ];

  const actualExports = Object.keys(PMFreakAocGovernanceRequestClientModule);
  for (const name of requiredExportNames) {
    assert.ok(actualExports.includes(name), `expected public export "${name}" to be present`);
  }
});

test("evidence requirement handoff module never calls attachment/task/mutation/communication capabilities on itself", () => {
  const files = listHandoffFiles();
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const forbidden of [
      "attachEvidence(",
      "uploadEvidence(",
      "createTask(",
      "mutateProject(",
      ".writebackDecision(",
      "sendEmail(",
      "postToSlack(",
      "createInvoice(",
      "notifyCustomer(",
    ]) {
      assert.ok(!content.includes(forbidden), `${path.relative(process.cwd(), file)} should not contain "${forbidden}"`);
    }
  }
});

test("existing governance client, decision inbox, governed action gate and gate result UI exports are still present", () => {
  const actualExports = Object.keys(PMFreakAocGovernanceRequestClientModule);
  assert.ok(actualExports.includes("createPMFreakAocGovernanceRequestClient"));
  assert.ok(actualExports.includes("createPMFreakAocDecisionInboxItemFromGovernanceResponse"));
  assert.ok(actualExports.includes("evaluatePMFreakAocGovernedActionGateFromGovernanceResponse"));
  assert.ok(actualExports.includes("createPMFreakAocGateResultUIDisplayModel"));
});
