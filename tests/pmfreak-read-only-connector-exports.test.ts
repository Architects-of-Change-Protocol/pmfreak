import test from "node:test";
import assert from "node:assert/strict";

import * as connector from "../src/features/aoc-integrations/pmfreak-read-only-connector";

test("public exports are complete", () => {
  const expectedConstants = [
    "AOC_PMFREAK_READ_ONLY_CONNECTOR_ID",
    "AOC_PMFREAK_READ_ONLY_CONNECTOR_NAME",
    "AOC_PMFREAK_SYSTEM_ID",
    "AOC_PMFREAK_READ_ONLY_CONNECTOR_CAPABILITIES",
    "AOC_PMFREAK_FORBIDDEN_CONNECTOR_OPERATIONS",
  ];

  const expectedFunctions = [
    "createAocPMFreakReadOnlyConnectorDescriptor",
    "createAocPMFreakReadOnlyConnectorConfig",
    "createAocPMFreakReadOnlyConnectorClient",
    "createAocPMFreakConnectorSnapshot",
    "createAocPMFreakConnectorHealth",
    "createAocPMFreakConnectorError",
    "createInMemoryAocPMFreakReadOnlySource",
    "createUnsupportedAocPMFreakRealReadOnlySource",
    "assertAocPMFreakReadOnlyOperation",
    "isAocPMFreakForbiddenConnectorOperation",
    "redactAocPMFreakConnectorValue",
    "redactAocPMFreakConnectorSnapshot",
    "evaluateAocPMFreakReadOnlyConnectorClaimSafety",
    "assertNoAocPMFreakReadOnlyConnectorOverclaim",
  ];

  for (const name of expectedConstants) {
    assert.notEqual((connector as Record<string, unknown>)[name], undefined, `missing export: ${name}`);
  }

  for (const name of expectedFunctions) {
    assert.equal(typeof (connector as Record<string, unknown>)[name], "function", `missing function export: ${name}`);
  }
});

test("connector ID and name constants have the expected values", () => {
  assert.equal(connector.AOC_PMFREAK_READ_ONLY_CONNECTOR_ID, "aoc.integration.pmfreak.read_only_connector.v1");
  assert.equal(connector.AOC_PMFREAK_READ_ONLY_CONNECTOR_NAME, "AOC PMFreak Read-Only Connector v1");
  assert.equal(connector.AOC_PMFREAK_SYSTEM_ID, "pmfreak");
});
