import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocRemoteGovernanceTransportConfig,
  createPMFreakAocRemoteGovernanceTransportHealth,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("health model is healthy without warnings or errors", () => {
  const config = createPMFreakAocRemoteGovernanceTransportConfig({ aocBaseUrl: "https://aoc.example.com" });
  const health = createPMFreakAocRemoteGovernanceTransportHealth({ config });

  assert.equal(health.status, "healthy");
  assert.equal(health.transportKind, "remote_http");
  assert.equal(health.endpointPath, "/api/aoc/pmfreak/governance/evaluate");
  assert.equal(health.actionExecutionCapable, false);
  assert.equal(health.productionMutationCapable, false);
  assert.equal(health.decisionWritebackCapable, false);
  assert.equal(health.invoiceCreationCapable, false);
  assert.equal(health.communicationCapable, false);
  assert.deepEqual(health.errors, []);
});

test("health model is degraded with config warnings", () => {
  const config = createPMFreakAocRemoteGovernanceTransportConfig({
    aocBaseUrl: "https://aoc.example.com",
    allowActionExecution: true as unknown as false,
  });
  const health = createPMFreakAocRemoteGovernanceTransportHealth({ config });

  assert.equal(health.status, "degraded");
  assert.ok(health.warnings.length > 0);
});

test("health model is degraded with explicit extra warnings", () => {
  const config = createPMFreakAocRemoteGovernanceTransportConfig({ aocBaseUrl: "https://aoc.example.com" });
  const health = createPMFreakAocRemoteGovernanceTransportHealth({ config, warnings: ["extra warning"] });

  assert.equal(health.status, "degraded");
  assert.ok(health.warnings.includes("extra warning"));
});

test("health model is unavailable with errors", () => {
  const config = createPMFreakAocRemoteGovernanceTransportConfig({ aocBaseUrl: "https://aoc.example.com" });
  const health = createPMFreakAocRemoteGovernanceTransportHealth({ config, errors: ["endpoint unreachable"] });

  assert.equal(health.status, "unavailable");
  assert.deepEqual(health.errors, ["endpoint unreachable"]);
});
