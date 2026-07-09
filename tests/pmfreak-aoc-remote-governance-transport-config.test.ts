import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocRemoteGovernanceTransportConfig,
  PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_ID,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("config requires aocBaseUrl for remote usage", () => {
  assert.throws(() => createPMFreakAocRemoteGovernanceTransportConfig({}), /aocBaseUrl is required/);
});

test("config defaults are safe", () => {
  const config = createPMFreakAocRemoteGovernanceTransportConfig({ aocBaseUrl: "https://aoc.example.com" });

  assert.equal(config.transportId, PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_ID);
  assert.equal(config.aocBaseUrl, "https://aoc.example.com");
  assert.equal(config.endpointPath, "/api/aoc/pmfreak/governance/evaluate");
  assert.equal(config.authMode, "none_demo");
  assert.equal(config.sharedSecretHeaderName, "x-aoc-governance-secret");
  assert.equal(config.timeoutMs, 5000);
  assert.equal(config.maxPayloadSizeKb, 256);
  assert.equal(config.redactionMode, "safe_demo");
  assert.deepEqual(config.notes, []);
  assert.deepEqual(config.warnings, []);
});

test("config accepts endpointPath, authMode and timeout overrides", () => {
  const config = createPMFreakAocRemoteGovernanceTransportConfig({
    aocBaseUrl: "https://aoc.example.com",
    endpointPath: "/custom/path",
    authMode: "bearer_token",
    bearerToken: "demo-token",
    timeoutMs: 1000,
    maxPayloadSizeKb: 64,
    redactionMode: "strict",
  });

  assert.equal(config.endpointPath, "/custom/path");
  assert.equal(config.authMode, "bearer_token");
  assert.equal(config.timeoutMs, 1000);
  assert.equal(config.maxPayloadSizeKb, 64);
  assert.equal(config.redactionMode, "strict");
});

test("config cannot enable action execution, mutations, writeback, invoice creation or communications", () => {
  const config = createPMFreakAocRemoteGovernanceTransportConfig({
    aocBaseUrl: "https://aoc.example.com",
    allowActionExecution: true as unknown as false,
    allowProductionMutations: true as unknown as false,
    allowDecisionWriteback: true as unknown as false,
    allowInvoiceCreation: true as unknown as false,
    allowCommunications: true as unknown as false,
  });

  assert.equal(config.allowActionExecution, false);
  assert.equal(config.allowProductionMutations, false);
  assert.equal(config.allowDecisionWriteback, false);
  assert.equal(config.allowInvoiceCreation, false);
  assert.equal(config.allowCommunications, false);

  assert.ok(config.warnings.some((warning) => /allowActionExecution/.test(warning)));
  assert.ok(config.warnings.some((warning) => /allowProductionMutations/.test(warning)));
  assert.ok(config.warnings.some((warning) => /allowDecisionWriteback/.test(warning)));
  assert.ok(config.warnings.some((warning) => /allowInvoiceCreation/.test(warning)));
  assert.ok(config.warnings.some((warning) => /allowCommunications/.test(warning)));
});

test("config warnings do not leak secrets", () => {
  const config = createPMFreakAocRemoteGovernanceTransportConfig({
    aocBaseUrl: "https://aoc.example.com",
    authMode: "bearer_token",
    bearerToken: "sk-demo-super-secret-token-value",
    allowActionExecution: true as unknown as false,
  });

  const serializedWarnings = JSON.stringify(config.warnings);
  assert.ok(!serializedWarnings.includes("sk-demo-super-secret-token-value"));
});
