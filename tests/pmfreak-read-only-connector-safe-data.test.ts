import test from "node:test";
import assert from "node:assert/strict";

import {
  AOC_PMFREAK_DEMO_ACTION_PROPOSALS,
  AOC_PMFREAK_DEMO_AGENTS,
  AOC_PMFREAK_DEMO_APPROVAL_REFERENCES,
  AOC_PMFREAK_DEMO_EVIDENCE_REFERENCES,
  AOC_PMFREAK_DEMO_MILESTONES,
  AOC_PMFREAK_DEMO_PROJECTS,
  AOC_PMFREAK_DEMO_RISKS,
  AOC_PMFREAK_DEMO_TASKS,
} from "../src/features/aoc-integrations/pmfreak-read-only-connector";

const ALLOWED_ID_PREFIXES = [
  "project.demo.",
  "customer.demo.",
  "tenant.demo.",
  "workspace.demo.",
  "pmfreak.agent.",
  "milestone.demo.",
  "task.demo.",
  "risk.demo.",
  "evidence.demo.",
  "approval.demo.",
  "proposal.demo.",
  "passport.demo.",
  "action.demo.",
];

const REAL_DATA_MARKERS = [
  "datasys",
  "@gmail.com",
  "@outlook.com",
  "@yahoo.com",
  "invoice-20",
  "contract no",
];

function allFixtureIds(): string[] {
  return [
    ...AOC_PMFREAK_DEMO_PROJECTS.map((p) => p.projectId),
    ...AOC_PMFREAK_DEMO_AGENTS.map((a) => a.agentId),
    ...AOC_PMFREAK_DEMO_MILESTONES.map((m) => m.milestoneId),
    ...AOC_PMFREAK_DEMO_TASKS.map((t) => t.taskId),
    ...AOC_PMFREAK_DEMO_RISKS.map((r) => r.riskId),
    ...AOC_PMFREAK_DEMO_EVIDENCE_REFERENCES.map((e) => e.evidenceReferenceId),
    ...AOC_PMFREAK_DEMO_APPROVAL_REFERENCES.map((a) => a.approvalReferenceId),
    ...AOC_PMFREAK_DEMO_ACTION_PROPOSALS.map((p) => p.actionProposalId),
  ];
}

test("all fixture IDs are fake/demo-scoped", () => {
  for (const id of allFixtureIds()) {
    assert.ok(
      ALLOWED_ID_PREFIXES.some((prefix) => id.startsWith(prefix)),
      `ID "${id}" does not look like a demo-scoped fake ID`
    );
  }
});

test("default fixtures contain no real Datasys/customer data markers", () => {
  const serialized = JSON.stringify({
    projects: AOC_PMFREAK_DEMO_PROJECTS,
    agents: AOC_PMFREAK_DEMO_AGENTS,
    milestones: AOC_PMFREAK_DEMO_MILESTONES,
    tasks: AOC_PMFREAK_DEMO_TASKS,
    risks: AOC_PMFREAK_DEMO_RISKS,
    evidenceReferences: AOC_PMFREAK_DEMO_EVIDENCE_REFERENCES,
    approvalReferences: AOC_PMFREAK_DEMO_APPROVAL_REFERENCES,
    actionProposals: AOC_PMFREAK_DEMO_ACTION_PROPOSALS,
  }).toLowerCase();

  for (const marker of REAL_DATA_MARKERS) {
    assert.equal(serialized.includes(marker), false, `Found suspicious marker "${marker}" in default fixtures`);
  }

  // No email-like strings anywhere in default fixtures.
  assert.doesNotMatch(serialized, /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
});
