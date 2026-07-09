import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocRemoteGovernanceTransportConfig,
  demoPMFreakAocBillingReadinessActionAttempt,
  createPMFreakAocGovernanceRequest,
  serializePMFreakAocRemoteGovernanceRequest,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const request = createPMFreakAocGovernanceRequest({ actionAttempt: demoPMFreakAocBillingReadinessActionAttempt() });

test("serializer builds the correct POST URL", () => {
  const config = createPMFreakAocRemoteGovernanceTransportConfig({ aocBaseUrl: "https://aoc.example.com" });
  const serialized = serializePMFreakAocRemoteGovernanceRequest(request, config);

  assert.equal(serialized.url, "https://aoc.example.com/api/aoc/pmfreak/governance/evaluate");
  assert.equal(serialized.method, "POST");
});

test("serializer normalizes a trailing slash in aocBaseUrl", () => {
  const config = createPMFreakAocRemoteGovernanceTransportConfig({ aocBaseUrl: "https://aoc.example.com/" });
  const serialized = serializePMFreakAocRemoteGovernanceRequest(request, config);

  assert.equal(serialized.url, "https://aoc.example.com/api/aoc/pmfreak/governance/evaluate");
});

test("serializer includes content-type application/json", () => {
  const config = createPMFreakAocRemoteGovernanceTransportConfig({ aocBaseUrl: "https://aoc.example.com" });
  const serialized = serializePMFreakAocRemoteGovernanceRequest(request, config);

  assert.equal(serialized.headers["content-type"], "application/json");
});

test("serializer includes the shared secret header only when configured", () => {
  const config = createPMFreakAocRemoteGovernanceTransportConfig({
    aocBaseUrl: "https://aoc.example.com",
    authMode: "shared_secret_header",
    sharedSecretHeaderName: "x-aoc-governance-secret",
    sharedSecretValue: "demo-shared-secret",
  });
  const serialized = serializePMFreakAocRemoteGovernanceRequest(request, config);

  assert.equal(serialized.headers["x-aoc-governance-secret"], "demo-shared-secret");
  assert.equal(serialized.headers.authorization, undefined);
});

test("serializer includes the bearer token only when configured", () => {
  const config = createPMFreakAocRemoteGovernanceTransportConfig({
    aocBaseUrl: "https://aoc.example.com",
    authMode: "bearer_token",
    bearerToken: "demo-bearer-token",
  });
  const serialized = serializePMFreakAocRemoteGovernanceRequest(request, config);

  assert.equal(serialized.headers.authorization, "Bearer demo-bearer-token");
  assert.equal(serialized.headers["x-aoc-governance-secret"], undefined);
});

test("serializer never includes undefined headers for none_demo auth", () => {
  const config = createPMFreakAocRemoteGovernanceTransportConfig({ aocBaseUrl: "https://aoc.example.com" });
  const serialized = serializePMFreakAocRemoteGovernanceRequest(request, config);

  for (const value of Object.values(serialized.headers)) {
    assert.notEqual(value, undefined);
  }
  assert.deepEqual(Object.keys(serialized.headers), ["content-type"]);
});

test("serializer rejects an unsupported auth mode safely", () => {
  const config = createPMFreakAocRemoteGovernanceTransportConfig({
    aocBaseUrl: "https://aoc.example.com",
    authMode: "unsupported",
  });

  assert.throws(() => serializePMFreakAocRemoteGovernanceRequest(request, config), /authMode "unsupported"/);
});

test("serializer rejects an oversized payload", () => {
  const config = createPMFreakAocRemoteGovernanceTransportConfig({ aocBaseUrl: "https://aoc.example.com", maxPayloadSizeKb: 0.01 });

  assert.throws(() => serializePMFreakAocRemoteGovernanceRequest(request, config), /exceeds the configured maxPayloadSizeKb/);
});

test("serializer does not mutate the input request", () => {
  const config = createPMFreakAocRemoteGovernanceTransportConfig({ aocBaseUrl: "https://aoc.example.com" });
  const snapshot = JSON.parse(JSON.stringify(request));

  serializePMFreakAocRemoteGovernanceRequest(request, config);

  assert.deepEqual(JSON.parse(JSON.stringify(request)), snapshot);
});
