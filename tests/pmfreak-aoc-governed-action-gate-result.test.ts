import test from "node:test";
import assert from "node:assert/strict";

import { buildPMFreakAocGovernedActionGateResultId, demoPMFreakAocGovernedActionGatePassedResult } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("buildPMFreakAocGovernedActionGateResultId is deterministic and namespaced", () => {
  const a = buildPMFreakAocGovernedActionGateResultId("demo.pmfreak.response.v1");
  const b = buildPMFreakAocGovernedActionGateResultId("demo.pmfreak.response.v1");
  assert.equal(a, b);
  assert.ok(a.startsWith("pmfreak.aoc.gate.result."));
  assert.ok(a.endsWith(".v1"));
});

test("gate result forces gateOnly = true and all capability flags to false", async () => {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  assert.equal(result.gateOnly, true);
  assert.equal(result.actionExecutionCapable, false);
  assert.equal(result.mutationCapable, false);
  assert.equal(result.writebackCapable, false);
  assert.equal(result.invoiceCreationCapable, false);
  assert.equal(result.communicationCapable, false);
  assert.equal(result.legalCertificationCapable, false);
  assert.equal(result.complianceCertificationCapable, false);
});

test("gate result carries a deterministic gateResultId scoped to the gate feature", async () => {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  assert.ok(result.gateResultId.startsWith("pmfreak.aoc.gate.result."));
  assert.equal(result.gateId, "pmfreak.integration.aoc.governed_action_gate.v1");
});
