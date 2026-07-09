import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocSurfaceSnapshot,
  createPMFreakAocReadOnlySurfaceConfig,
} from "../src/features/pmfreak-integrations/aoc-read-only-surface";
import type { PMFreakProjectReadModel } from "../src/features/pmfreak-integrations/aoc-read-only-surface";

function baseInput() {
  const config = createPMFreakAocReadOnlySurfaceConfig();
  const projects: PMFreakProjectReadModel[] = [
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

test("surface snapshot is deterministic for the same input", () => {
  const a = createPMFreakAocSurfaceSnapshot(baseInput());
  const b = createPMFreakAocSurfaceSnapshot(baseInput());
  assert.deepEqual(a, b);
});

test("surface snapshot counts are correct", () => {
  const snapshot = createPMFreakAocSurfaceSnapshot(baseInput());
  assert.equal(snapshot.counts.projects, 1);
  assert.equal(snapshot.counts.agents, 0);
  assert.equal(snapshot.readOnly, true);
  assert.equal(snapshot.allowMutations, false);
});

test("surface snapshot copies arrays so mutating the input does not mutate the snapshot", () => {
  const input = baseInput();
  const snapshot = createPMFreakAocSurfaceSnapshot(input);

  input.projects[0].projectName = "mutated-after-snapshot";
  assert.notEqual(snapshot.projects[0].projectName, "mutated-after-snapshot");

  snapshot.projects.push({ ...input.projects[0], projectId: "project.demo.pushed" });
  assert.equal(input.projects.length, 1);
});
