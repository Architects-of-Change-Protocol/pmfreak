import test from "node:test";
import assert from "node:assert/strict";

import {
  AOC_PMFREAK_DEMO_ACTION_PROPOSALS,
  AOC_PMFREAK_DEMO_AGENTS,
  AOC_PMFREAK_DEMO_MILESTONES,
  AOC_PMFREAK_DEMO_PROJECTS,
} from "../src/features/aoc-integrations/pmfreak-read-only-connector";

test("read models accept deterministic demo data", () => {
  assert.ok(AOC_PMFREAK_DEMO_PROJECTS.some((p) => p.projectId === "project.demo.network-refresh"));
  assert.ok(AOC_PMFREAK_DEMO_AGENTS.some((a) => a.agentId === "pmfreak.agent.billing_readiness"));
  assert.ok(AOC_PMFREAK_DEMO_MILESTONES.some((m) => m.milestoneId === "milestone.demo.network-refresh.phase-1-delivery"));
  assert.ok(AOC_PMFREAK_DEMO_ACTION_PROPOSALS.some((p) => p.actionProposalId === "proposal.demo.billing-readiness.mark-ready"));
});

test("project read model links to its milestone/task/risk/evidence/approval/action-proposal graph", () => {
  const project = AOC_PMFREAK_DEMO_PROJECTS.find((p) => p.projectId === "project.demo.network-refresh");
  assert.ok(project);
  assert.ok(project.milestoneIds.includes("milestone.demo.network-refresh.phase-1-delivery"));
  assert.ok(project.taskIds.includes("task.demo.network-refresh.collect-acceptance"));
  assert.ok(project.riskIds.includes("risk.demo.unconfirmed-customer-acceptance"));
  assert.ok(project.evidenceReferenceIds.includes("evidence.demo.customer-acceptance.missing"));
  assert.ok(project.approvalReferenceIds.includes("approval.demo.billing-review.missing"));
  assert.ok(project.actionProposalIds.includes("proposal.demo.billing-readiness.mark-ready"));
});
