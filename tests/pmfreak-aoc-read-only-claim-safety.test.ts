import test from "node:test";
import assert from "node:assert/strict";

import {
  PMFREAK_AOC_READ_ONLY_SURFACE_PROHIBITED_OVERCLAIM_PHRASES,
  PMFreakAocReadOnlySurfaceOverclaimError,
  assertNoPMFreakAocReadOnlySurfaceOverclaim,
  createPMFreakAocSurfaceSnapshot,
  createPMFreakAocReadOnlySurfaceConfig,
  createPMFreakAocReadOnlySurfaceDescriptor,
  createInMemoryPMFreakAocReadOnlySource,
  createPMFreakAocReadOnlySurfaceClient,
  evaluatePMFreakAocReadOnlySurfaceClaimSafety,
} from "../src/features/pmfreak-integrations/aoc-read-only-surface";

test("unsafe surface claims are caught", () => {
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
    "production surface certified",
    "write access enabled",
    "mutation allowed",
    "certified pmfreak surface",
  ];

  for (const phrase of unsafePhrases) {
    const result = evaluatePMFreakAocReadOnlySurfaceClaimSafety({ summary: `This surface is ${phrase}.` });
    assert.equal(result.safe, false, `expected "${phrase}" to be flagged`);
    assert.throws(
      () => assertNoPMFreakAocReadOnlySurfaceOverclaim({ summary: `This surface is ${phrase}.` }),
      PMFreakAocReadOnlySurfaceOverclaimError
    );
  }
});

test("every prohibited phrase in the constant list is caught", () => {
  for (const phrase of PMFREAK_AOC_READ_ONLY_SURFACE_PROHIBITED_OVERCLAIM_PHRASES) {
    const result = evaluatePMFreakAocReadOnlySurfaceClaimSafety({ summary: phrase });
    assert.equal(result.safe, false, `expected "${phrase}" to be flagged`);
  }
});

test("safe surface phrases do not false-positive", () => {
  const safePhrases = [
    "read-only integration surface",
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
    const result = evaluatePMFreakAocReadOnlySurfaceClaimSafety({ summary: phrase });
    assert.equal(result.safe, true, `expected "${phrase}" to be safe`);
  }

  assert.doesNotThrow(() => assertNoPMFreakAocReadOnlySurfaceOverclaim({ summary: safePhrases }));
});

test("descriptor and config pass no-overclaim", () => {
  assert.doesNotThrow(() => assertNoPMFreakAocReadOnlySurfaceOverclaim(createPMFreakAocReadOnlySurfaceDescriptor()));
  assert.doesNotThrow(() => assertNoPMFreakAocReadOnlySurfaceOverclaim(createPMFreakAocReadOnlySurfaceConfig()));
});

test("surface snapshot passes no-overclaim", async () => {
  const client = createPMFreakAocReadOnlySurfaceClient({ source: createInMemoryPMFreakAocReadOnlySource() });
  const snapshot = await client.readSnapshot();
  assert.doesNotThrow(() => assertNoPMFreakAocReadOnlySurfaceOverclaim(snapshot));

  const config = createPMFreakAocReadOnlySurfaceConfig();
  const emptySnapshot = createPMFreakAocSurfaceSnapshot({
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
  assert.doesNotThrow(() => assertNoPMFreakAocReadOnlySurfaceOverclaim(emptySnapshot));
});
