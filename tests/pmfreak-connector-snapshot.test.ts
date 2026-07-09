import test from "node:test";
import assert from "node:assert/strict";

import {
  createAocPMFreakConnectorSnapshot,
  createAocPMFreakReadOnlyConnectorConfig,
} from "../src/features/aoc-integrations/pmfreak-read-only-connector";
import type { AocPMFreakProjectReadModel } from "../src/features/aoc-integrations/pmfreak-read-only-connector";

function baseInput() {
  const config = createAocPMFreakReadOnlyConnectorConfig();
  const projects: AocPMFreakProjectReadModel[] = [
    {
      projectId: "project.demo.network-refresh",
      workspaceId: "workspace.demo.pmfreak",
      milestoneIds: [],
      taskIds: [],
      riskIds: [],
      evidenceReferenceIds: [],
      approvalReferenceIds: [],
      actionProposalIds: [],
      metadata: {},
    },
  ];
  return {
    config,
    projects,
    agents: [],
    milestones: [],
    tasks: [],
    risks: [],
    evidenceReferences: [],
    approvalReferences: [],
    actionProposals: [],
  };
}

test("connector snapshot is deterministic for the same input", () => {
  const a = createAocPMFreakConnectorSnapshot(baseInput());
  const b = createAocPMFreakConnectorSnapshot(baseInput());
  assert.deepEqual(a, b);
});

test("connector snapshot counts are correct", () => {
  const snapshot = createAocPMFreakConnectorSnapshot(baseInput());
  assert.equal(snapshot.counts.projects, 1);
  assert.equal(snapshot.counts.agents, 0);
  assert.equal(snapshot.readOnly, true);
  assert.equal(snapshot.allowMutations, false);
});

test("connector snapshot copies arrays so mutating the input does not mutate the snapshot", () => {
  const input = baseInput();
  const snapshot = createAocPMFreakConnectorSnapshot(input);

  input.projects[0].projectName = "mutated-after-snapshot";
  assert.notEqual(snapshot.projects[0].projectName, "mutated-after-snapshot");

  snapshot.projects.push({ ...input.projects[0], projectId: "project.demo.pushed" });
  assert.equal(input.projects.length, 1);
});
