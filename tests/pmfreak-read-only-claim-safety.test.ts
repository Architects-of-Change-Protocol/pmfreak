import test from "node:test";
import assert from "node:assert/strict";

import {
  AOC_PMFREAK_READ_ONLY_CONNECTOR_PROHIBITED_OVERCLAIM_PHRASES,
  AocPMFreakReadOnlyConnectorOverclaimError,
  assertNoAocPMFreakReadOnlyConnectorOverclaim,
  createAocPMFreakConnectorSnapshot,
  createAocPMFreakReadOnlyConnectorConfig,
  createAocPMFreakReadOnlyConnectorDescriptor,
  createInMemoryAocPMFreakReadOnlySource,
  createAocPMFreakReadOnlyConnectorClient,
  evaluateAocPMFreakReadOnlyConnectorClaimSafety,
} from "../src/features/aoc-integrations/pmfreak-read-only-connector";

test("unsafe connector claims are caught", () => {
  const unsafePhrases = [
    "fully trusted agent",
    "certified enterprise compliant",
    "risk-free execution",
    "production authorized",
    "invoice-ready certified",
    "customer acceptance certified",
    "contractually compliant",
    "legally approved",
    "compliance passed",
    "guaranteed billing",
    "production connector certified",
    "write access enabled",
    "mutation allowed",
    "certified pmfreak connector",
  ];

  for (const phrase of unsafePhrases) {
    const result = evaluateAocPMFreakReadOnlyConnectorClaimSafety({ summary: `This connector is ${phrase}.` });
    assert.equal(result.safe, false, `expected "${phrase}" to be flagged`);
    assert.throws(
      () => assertNoAocPMFreakReadOnlyConnectorOverclaim({ summary: `This connector is ${phrase}.` }),
      AocPMFreakReadOnlyConnectorOverclaimError
    );
  }
});

test("every prohibited phrase in the constant list is caught", () => {
  for (const phrase of AOC_PMFREAK_READ_ONLY_CONNECTOR_PROHIBITED_OVERCLAIM_PHRASES) {
    const result = evaluateAocPMFreakReadOnlyConnectorClaimSafety({ summary: phrase });
    assert.equal(result.safe, false, `expected "${phrase}" to be flagged`);
  }
});

test("safe connector phrases do not false-positive", () => {
  const safePhrases = [
    "read-only connector",
    "read-only PMFreak data",
    "Not production execution",
    "Not compliance certification",
    "No invoice validity claimed",
    "No customer acceptance certification",
    "No mutation performed",
    "No writeback performed",
    "AOC-governed agent",
  ];

  for (const phrase of safePhrases) {
    const result = evaluateAocPMFreakReadOnlyConnectorClaimSafety({ summary: phrase });
    assert.equal(result.safe, true, `expected "${phrase}" to be safe`);
  }

  assert.doesNotThrow(() => assertNoAocPMFreakReadOnlyConnectorOverclaim({ summary: safePhrases }));
});

test("descriptor and config pass no-overclaim", () => {
  assert.doesNotThrow(() => assertNoAocPMFreakReadOnlyConnectorOverclaim(createAocPMFreakReadOnlyConnectorDescriptor()));
  assert.doesNotThrow(() => assertNoAocPMFreakReadOnlyConnectorOverclaim(createAocPMFreakReadOnlyConnectorConfig()));
});

test("connector snapshot passes no-overclaim", async () => {
  const client = createAocPMFreakReadOnlyConnectorClient({ source: createInMemoryAocPMFreakReadOnlySource() });
  const snapshot = await client.readSnapshot();
  assert.doesNotThrow(() => assertNoAocPMFreakReadOnlyConnectorOverclaim(snapshot));

  const config = createAocPMFreakReadOnlyConnectorConfig();
  const emptySnapshot = createAocPMFreakConnectorSnapshot({
    config,
    projects: [],
    agents: [],
    milestones: [],
    tasks: [],
    risks: [],
    evidenceReferences: [],
    approvalReferences: [],
    actionProposals: [],
  });
  assert.doesNotThrow(() => assertNoAocPMFreakReadOnlyConnectorOverclaim(emptySnapshot));
});
