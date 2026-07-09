import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import * as PMFreakAocGovernanceRequestClientModule from "../src/features/pmfreak-integrations/aoc-governance-request-client";
import {
  createRemoteHttpPMFreakAocGovernanceTransport,
  createSuccessfulAocRemoteGovernanceFetchMock,
  demoPMFreakAocBillingReadinessActionAttempt,
  demoPMFreakAocRemoteTransportBillingAllowedEndpointBody,
  createPMFreakAocGovernanceRequestClientConfig,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";
import { createPMFreakAocGovernanceRequest } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const MODULE_DIR = path.resolve(process.cwd(), "src/features/pmfreak-integrations/aoc-governance-request-client");

const FORBIDDEN_SIDE_EFFECT_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "fs write", pattern: /\bfs\.(writeFile|appendFile|unlink|rm|mkdir)/ },
  { label: "child_process", pattern: /child_process/ },
  { label: "database client", pattern: /\b(supabase|prisma|pg\.Pool|mongoose)\b/i },
  { label: "outbound email", pattern: /\b(nodemailer|sendgrid|ses\.sendEmail)\b/i },
  { label: "Slack/Teams webhook", pattern: /\b(slack|teams)\b.*webhook/i },
];

function listRemoteGovernanceModuleFiles(): string[] {
  return fs
    .readdirSync(MODULE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^pmfreak-aoc-remote-governance-.*\.ts$/.test(entry.name))
    .map((entry) => path.join(MODULE_DIR, entry.name));
}

test("static scan confirms no action-execution or production side-effect APIs in the remote governance transport module", () => {
  const files = listRemoteGovernanceModuleFiles();
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

test("public exports include the full v1 remote transport surface", () => {
  const requiredExportNames = [
    "PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_ID",
    "PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_NAME",
    "PMFREAK_AOC_REMOTE_GOVERNANCE_DEFAULT_ENDPOINT_PATH",
    "PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_CAPABILITIES",
    "PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_FORBIDDEN_OPERATIONS",
    "createPMFreakAocRemoteGovernanceTransportDescriptor",
    "createPMFreakAocRemoteGovernanceTransportConfig",
    "serializePMFreakAocRemoteGovernanceRequest",
    "parsePMFreakAocRemoteGovernanceEndpointBody",
    "validatePMFreakAocRemoteAocGovernanceResponse",
    "mapAocEndpointResponseToPMFreakAocGovernanceResponse",
    "createRemoteHttpPMFreakAocGovernanceTransport",
    "createPMFreakAocRemoteGovernanceTransportHealth",
    "createPMFreakAocRemoteGovernanceTransportError",
    "redactPMFreakAocRemoteGovernanceTransportValue",
    "evaluatePMFreakAocRemoteGovernanceTransportClaimSafety",
    "assertNoPMFreakAocRemoteGovernanceTransportOverclaim",
    "PMFreakAocRemoteGovernanceTransportError",
  ];

  const actualExports = Object.keys(PMFreakAocGovernanceRequestClientModule);
  for (const name of requiredExportNames) {
    assert.ok(actualExports.includes(name), `expected public export "${name}" to be present`);
  }
});

test("remote transport does not execute PMFreak actions, mutate data, write back decisions, communicate or create invoices", async () => {
  const transport = createRemoteHttpPMFreakAocGovernanceTransport(
    { aocBaseUrl: "https://aoc.example.com" },
    { fetchImpl: createSuccessfulAocRemoteGovernanceFetchMock(demoPMFreakAocRemoteTransportBillingAllowedEndpointBody()) },
  );

  for (const forbiddenMethod of ["executeAction", "applyDecision", "mutateProject", "createInvoice", "sendEmail", "writebackDecision"]) {
    assert.ok(!(forbiddenMethod in transport), `transport must not expose "${forbiddenMethod}"`);
  }

  const request = createPMFreakAocGovernanceRequest({ actionAttempt: demoPMFreakAocBillingReadinessActionAttempt() });
  const response = await transport.evaluateGovernanceRequest(request, createPMFreakAocGovernanceRequestClientConfig());

  assert.ok(response.disclaimers.some((line) => /does not execute PMFreak actions/i.test(line)));
  assert.ok(response.disclaimers.some((line) => /does not mutate PMFreak data/i.test(line)));
  assert.ok(response.disclaimers.some((line) => /does not write back decisions/i.test(line)));
  assert.ok(response.disclaimers.some((line) => /does not send communications/i.test(line)));
  assert.ok(response.disclaimers.some((line) => /does not create invoices/i.test(line)));
  assert.ok(response.disclaimers.some((line) => /does not certify invoice validity/i.test(line)));
  assert.ok(response.disclaimers.some((line) => /does not certify customer acceptance/i.test(line)));
  assert.ok(response.disclaimers.some((line) => /does not certify compliance/i.test(line)));
  assert.ok(response.disclaimers.some((line) => /does not provide legal advice/i.test(line)));
});
