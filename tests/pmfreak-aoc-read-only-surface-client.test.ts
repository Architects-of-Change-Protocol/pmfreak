import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocReadOnlySurfaceClient,
  createInMemoryPMFreakAocReadOnlySource,
} from "../src/features/pmfreak-integrations/aoc-read-only-surface";

test("surface client reads full snapshot", async () => {
  const client = createPMFreakAocReadOnlySurfaceClient({
    source: createInMemoryPMFreakAocReadOnlySource(),
  });

  const snapshot = await client.readSnapshot();

  assert.equal(snapshot.surfaceId, "pmfreak.integration.aoc.read_only_surface.v1");
  assert.equal(snapshot.readOnly, true);
  assert.equal(snapshot.allowMutations, false);

  assert.equal(snapshot.counts.projects, snapshot.projects.length);
  assert.equal(snapshot.counts.agents, snapshot.agents.length);
  assert.equal(snapshot.counts.milestones, snapshot.milestones.length);
  assert.equal(snapshot.counts.tasks, snapshot.tasks.length);
  assert.equal(snapshot.counts.risks, snapshot.risks.length);
  assert.equal(snapshot.counts.evidenceReferences, snapshot.evidenceReferences.length);
  assert.equal(snapshot.counts.approvalReferences, snapshot.approvalReferences.length);
  assert.equal(snapshot.counts.actionProposals, snapshot.actionProposals.length);

  assert.ok(snapshot.safeLabels.length > 0);
});

test("surface client applies redaction to the snapshot when redactionMode is safe_demo", async () => {
  const client = createPMFreakAocReadOnlySurfaceClient({
    source: createInMemoryPMFreakAocReadOnlySource({
      projects: [
        {
          projectId: "project.demo.redaction-check",
          workspaceId: "workspace.demo.pmfreak",
          milestoneIds: [],
          taskIds: [],
          riskIds: [],
          evidenceReferenceIds: [],
          approvalReferenceIds: [],
          actionProposalIds: [],
          metadata: { contactEmail: "someone@example.com", apiToken: "sk-demo-12345" },
        },
      ],
    }),
    config: { redactionMode: "safe_demo" },
  });

  const snapshot = await client.readSnapshot();
  const project = snapshot.projects[0];

  assert.equal(project.metadata.contactEmail, "[redacted-email]");
  assert.equal(project.metadata.apiToken, "[redacted-secret]");
});

test("surface client health check reports healthy for the in-memory source", async () => {
  const client = createPMFreakAocReadOnlySurfaceClient({
    source: createInMemoryPMFreakAocReadOnlySource(),
  });

  const health = await client.getHealth();
  assert.equal(health.status, "healthy");
  assert.equal(health.readOnly, true);
  assert.equal(health.allowMutations, false);
});

test("surface client readSnapshot fails closed with a safe error when the source rejects", async () => {
  const client = createPMFreakAocReadOnlySurfaceClient({
    source: {
      sourceKind: "unknown",
      listProjects: async () => {
        throw new Error("simulated network failure with secret=abc123");
      },
      listAgents: async () => [],
      listMilestones: async () => [],
      listTasks: async () => [],
      listRisks: async () => [],
      listEvidenceReferences: async () => [],
      listApprovalReferences: async () => [],
      listActionProposals: async () => [],
    },
  });

  await assert.rejects(() => client.readSnapshot(), (error: unknown) => {
    const surfaceError = error as { safe?: boolean; code?: string; message?: string };
    assert.equal(surfaceError.safe, true);
    assert.equal(surfaceError.code, "read_failed");
    assert.ok(!surfaceError.message?.includes("secret=abc123"));
    return true;
  });
});
