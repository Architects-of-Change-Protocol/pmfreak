import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocGovernanceRequestClientConfig,
  PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_ID,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("config defaults are safe", () => {
  const config = createPMFreakAocGovernanceRequestClientConfig();

  assert.equal(config.clientId, PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_ID);
  assert.equal(config.environment, "demo");
  assert.equal(config.transportKind, "local_mock");
  assert.equal(config.requestMode, "dry_run");
  assert.equal(config.allowProductionMutations, false);
  assert.equal(config.allowActionExecution, false);
  assert.equal(config.allowDecisionWriteback, false);
  assert.equal(config.redactionMode, "safe_demo");
  assert.equal(config.timeoutMs, 5000);
  assert.equal(config.maxPayloadSizeKb, 256);
  assert.deepEqual(config.notes, []);
  assert.deepEqual(config.warnings, []);
});

test("config cannot enable production mutation, action execution or decision writeback", () => {
  const config = createPMFreakAocGovernanceRequestClientConfig({
    allowProductionMutations: true as unknown as false,
    allowActionExecution: true as unknown as false,
    allowDecisionWriteback: true as unknown as false,
  });

  assert.equal(config.allowProductionMutations, false);
  assert.equal(config.allowActionExecution, false);
  assert.equal(config.allowDecisionWriteback, false);
  assert.ok(config.warnings.some((warning) => /allowProductionMutations/.test(warning)));
  assert.ok(config.warnings.some((warning) => /allowActionExecution/.test(warning)));
  assert.ok(config.warnings.some((warning) => /allowDecisionWriteback/.test(warning)));
});

test("config accepts environment, transport and redaction overrides", () => {
  const config = createPMFreakAocGovernanceRequestClientConfig({
    environment: "staging",
    transportKind: "unsupported_remote",
    redactionMode: "strict",
    requestMode: "evaluate_only",
  });

  assert.equal(config.environment, "staging");
  assert.equal(config.transportKind, "unsupported_remote");
  assert.equal(config.redactionMode, "strict");
  assert.equal(config.requestMode, "evaluate_only");
});
