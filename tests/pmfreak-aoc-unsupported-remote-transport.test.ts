import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocGovernanceRequestClientConfig,
  createUnsupportedRemotePMFreakAocGovernanceTransport,
  demoPMFreakAocRiskEscalationAllowedRequest,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("unsupported remote transport fails safely with no network call", async () => {
  const transport = createUnsupportedRemotePMFreakAocGovernanceTransport();
  const config = createPMFreakAocGovernanceRequestClientConfig({ transportKind: "unsupported_remote" });

  assert.equal(transport.transportKind, "unsupported_remote");

  const response = await transport.evaluateGovernanceRequest(demoPMFreakAocRiskEscalationAllowedRequest(), config);

  assert.equal(response.evaluatedBy, "unsupported_remote");
  assert.equal(response.decision, "hold");
  assert.ok(response.errors.includes("unsupported_remote_transport"));
  assert.ok(response.reasonCodes.includes("unsupported_remote_transport"));
});

test("unsupported remote transport source performs no network I/O", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "src/features/pmfreak-integrations/aoc-governance-request-client/pmfreak-aoc-unsupported-remote-transport.ts"),
    "utf8",
  );

  for (const forbidden of ["fetch(", "axios", "XMLHttpRequest", "http.request", "https.request"]) {
    assert.ok(!source.includes(forbidden), `unsupported remote transport must not reference "${forbidden}"`);
  }
});
