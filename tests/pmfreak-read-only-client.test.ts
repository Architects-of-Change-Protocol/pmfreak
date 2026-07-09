import test from "node:test";
import assert from "node:assert/strict";

import {
  createAocPMFreakReadOnlyConnectorClient,
  createInMemoryAocPMFreakReadOnlySource,
} from "../src/features/aoc-integrations/pmfreak-read-only-connector";

test("connector client reads full snapshot", async () => {
  const client = createAocPMFreakReadOnlyConnectorClient({
    source: createInMemoryAocPMFreakReadOnlySource(),
  });

  const snapshot = await client.readSnapshot();

  assert.equal(snapshot.connectorId, "aoc.integration.pmfreak.read_only_connector.v1");
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

test("connector client applies redaction to the snapshot when redactionMode is safe_demo", async () => {
  const client = createAocPMFreakReadOnlyConnectorClient({
    source: createInMemoryAocPMFreakReadOnlySource({
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

test("connector client health check reports healthy for the in-memory source", async () => {
  const client = createAocPMFreakReadOnlyConnectorClient({
    source: createInMemoryAocPMFreakReadOnlySource(),
  });

  const health = await client.getHealth();
  assert.equal(health.status, "healthy");
  assert.equal(health.readOnly, true);
  assert.equal(health.allowMutations, false);
});

test("connector client readSnapshot fails closed with a safe error when the source rejects", async () => {
  const client = createAocPMFreakReadOnlyConnectorClient({
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
    const connectorError = error as { safe?: boolean; code?: string; message?: string };
    assert.equal(connectorError.safe, true);
    assert.equal(connectorError.code, "read_failed");
    assert.ok(!connectorError.message?.includes("secret=abc123"));
    return true;
  });
});
