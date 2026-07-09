import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocReadOnlySurfaceConfig,
  createInMemoryPMFreakAocReadOnlySource,
} from "../src/features/pmfreak-integrations/aoc-read-only-surface";

const config = createPMFreakAocReadOnlySurfaceConfig();

test("in-memory source lists projects deterministically without mutation", async () => {
  const source = createInMemoryPMFreakAocReadOnlySource();
  const first = await source.listProjects(config);
  const second = await source.listProjects(config);

  assert.deepEqual(first, second);
  assert.ok(first.some((p) => p.projectId === "project.demo.network-refresh"));

  first[0].projectName = "mutated";
  const third = await source.listProjects(config);
  assert.notEqual(third[0].projectName, "mutated");
});

test("in-memory source lists agents deterministically", async () => {
  const source = createInMemoryPMFreakAocReadOnlySource();
  const first = await source.listAgents(config);
  const second = await source.listAgents(config);

  assert.deepEqual(first, second);
  assert.ok(first.some((a) => a.agentId === "pmfreak.agent.billing_readiness"));
});

test("in-memory source lists milestones/tasks/risks matching the fixture graph", async () => {
  const source = createInMemoryPMFreakAocReadOnlySource();
  const [milestones, tasks, risks] = await Promise.all([
    source.listMilestones(config),
    source.listTasks(config),
    source.listRisks(config),
  ]);

  const milestone = milestones.find((m) => m.milestoneId === "milestone.demo.network-refresh.phase-1-delivery");
  assert.ok(milestone);
  assert.equal(milestone?.projectId, "project.demo.network-refresh");

  const task = tasks.find((t) => t.taskId === "task.demo.network-refresh.collect-acceptance");
  assert.ok(task);
  assert.equal(task?.milestoneId, "milestone.demo.network-refresh.phase-1-delivery");

  const risk = risks.find((r) => r.riskId === "risk.demo.unconfirmed-customer-acceptance");
  assert.ok(risk);
  assert.equal(risk?.projectId, "project.demo.network-refresh");
});

test("in-memory source lists evidence and approval references with kinds and present flags preserved", async () => {
  const source = createInMemoryPMFreakAocReadOnlySource();
  const [evidenceReferences, approvalReferences] = await Promise.all([
    source.listEvidenceReferences(config),
    source.listApprovalReferences(config),
  ]);

  const evidence = evidenceReferences.find((e) => e.evidenceKind === "customer_acceptance_record");
  assert.ok(evidence);
  assert.equal(evidence?.present, false);

  const approval = approvalReferences.find((a) => a.approvalKind === "billing_review");
  assert.ok(approval);
  assert.equal(approval?.present, false);
});

test("in-memory source lists action proposals including the billing mark-ready proposal", async () => {
  const source = createInMemoryPMFreakAocReadOnlySource();
  const actionProposals = await source.listActionProposals(config);

  const proposal = actionProposals.find((p) => p.actionProposalId === "proposal.demo.billing-readiness.mark-ready");
  assert.ok(proposal);
  assert.equal(proposal?.category, "billing");
  assert.ok(proposal?.contextFlags.includes("billing_sensitive"));
  assert.ok(proposal?.contextFlags.includes("project_closure_sensitive"));
});

test("in-memory source accepts fixture overrides", async () => {
  const source = createInMemoryPMFreakAocReadOnlySource({
    projects: [
      {
        projectId: "project.demo.custom",
        workspaceId: "workspace.demo.pmfreak",
        milestoneIds: [],
        taskIds: [],
        riskIds: [],
        evidenceReferenceIds: [],
        approvalReferenceIds: [],
        actionProposalIds: [],
        metadata: {},
      },
    ],
  });

  const projects = await source.listProjects(config);
  assert.equal(projects.length, 1);
  assert.equal(projects[0].projectId, "project.demo.custom");
});
