import test from "node:test";
import assert from "node:assert/strict";

import {
  PMFREAK_DEMO_ACTION_PROPOSALS,
  PMFREAK_DEMO_AGENTS,
  PMFREAK_DEMO_APPROVAL_REFERENCES,
  PMFREAK_DEMO_EVIDENCE_REFERENCES,
  PMFREAK_DEMO_MILESTONES,
  PMFREAK_DEMO_PROJECTS,
  PMFREAK_DEMO_RISKS,
  PMFREAK_DEMO_TASKS,
} from "../src/features/pmfreak-integrations/aoc-read-only-surface";

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
    ...PMFREAK_DEMO_PROJECTS.map((p) => p.projectId),
    ...PMFREAK_DEMO_AGENTS.map((a) => a.agentId),
    ...PMFREAK_DEMO_MILESTONES.map((m) => m.milestoneId),
    ...PMFREAK_DEMO_TASKS.map((t) => t.taskId),
    ...PMFREAK_DEMO_RISKS.map((r) => r.riskId),
    ...PMFREAK_DEMO_EVIDENCE_REFERENCES.map((e) => e.evidenceReferenceId),
    ...PMFREAK_DEMO_APPROVAL_REFERENCES.map((a) => a.approvalReferenceId),
    ...PMFREAK_DEMO_ACTION_PROPOSALS.map((p) => p.actionProposalId),
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
    projects: PMFREAK_DEMO_PROJECTS,
    agents: PMFREAK_DEMO_AGENTS,
    milestones: PMFREAK_DEMO_MILESTONES,
    tasks: PMFREAK_DEMO_TASKS,
    risks: PMFREAK_DEMO_RISKS,
    evidenceReferences: PMFREAK_DEMO_EVIDENCE_REFERENCES,
    approvalReferences: PMFREAK_DEMO_APPROVAL_REFERENCES,
    actionProposals: PMFREAK_DEMO_ACTION_PROPOSALS,
  }).toLowerCase();

  for (const marker of REAL_DATA_MARKERS) {
    assert.equal(serialized.includes(marker), false, `Found suspicious marker "${marker}" in default fixtures`);
  }

  // No email-like strings anywhere in default fixtures.
  assert.doesNotMatch(serialized, /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
});
