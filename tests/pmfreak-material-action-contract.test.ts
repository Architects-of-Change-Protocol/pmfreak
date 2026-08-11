import test from "node:test";
import assert from "node:assert/strict";
import { comparePMFreakMaterialActionReplay, createPMFreakMaterialActionProposal, evaluatePMFreakMaterialActionGovernance } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const base = () => ({
  actionId: "action-1", workspaceId: "workspace-a", projectId: "project-a", originatingSubjectType: "decision" as const,
  originatingSubjectId: "decision-1", decisionReferenceId: "decision-1", sourceCorrelationId: "correlation-1",
  evidenceReferenceIds: ["evidence-b", "evidence-a"], actionClass: "external_write" as const, actionType: "update_schedule",
  targetResourceType: "external_schedule", targetResourceId: "schedule-1", intendedOperation: "update",
  intendedEffect: "Move milestone by two days", risk: "high" as const, reversibility: "partially_reversible" as const,
  sideEffect: "external" as const, proposedActorId: "user-proposer", accountableActorId: "user-owner", requiredApprovalCount: 1,
  justification: "Approved recovery option", createdAt: "2026-08-11T12:00:00.000Z", expiresAt: "2026-08-12T12:00:00.000Z", idempotencyKey: "decision-1:update_schedule:v1",
});

test("canonical proposal remains separate from Decision, Task, execution, outcome and learning", () => {
  const proposal = createPMFreakMaterialActionProposal(base());
  assert.equal(proposal.schemaVersion, "pmfreak.material-action.v1");
  assert.equal(proposal.materiality, "material");
  assert.match(proposal.deterministicDigest, /^[a-f0-9]{64}$/);
  assert.equal(proposal.createsTask, false);
  assert.equal(proposal.dispatchesAction, false);
  assert.equal(proposal.executesAction, false);
  assert.equal(proposal.remoteDecisionWriteback, false);
  assert.equal("taskId" in proposal, false);
  assert.equal("outcomeId" in proposal, false);
});

test("canonicalization is deterministic and collection ordering is stable", () => {
  const first = createPMFreakMaterialActionProposal(base());
  const second = createPMFreakMaterialActionProposal({ ...base(), evidenceReferenceIds: ["evidence-a", "evidence-b", "evidence-a"] });
  assert.equal(first.deterministicDigest, second.deterministicDigest);
  assert.equal(comparePMFreakMaterialActionReplay(first, second), "replay");
  assert.equal(comparePMFreakMaterialActionReplay(first, createPMFreakMaterialActionProposal({ ...base(), intendedEffect: "Different effect" })), "conflict");
  assert.equal(comparePMFreakMaterialActionReplay(first, createPMFreakMaterialActionProposal({ ...base(), idempotencyKey: "different-key" })), "distinct");
  assert.equal(Object.isFrozen(first.evidenceReferenceIds), true);
});

test("ordinary reversible internal business write does not impersonate AOC authority", () => {
  const proposal = createPMFreakMaterialActionProposal({ ...base(), actionClass: "ordinary_business_write", risk: "low", reversibility: "reversible", sideEffect: "internal", requiredApprovalCount: 0 });
  const result = evaluatePMFreakMaterialActionGovernance(proposal, { evaluationId: "eval-1", evaluatedAt: "2026-08-11T12:01:00Z", evaluatorActorId: "server", state: "not_required", obligationReferenceIds: [], approvalReferenceIds: [], reasonCodes: ["ordinary_business_authority"] }, new Date("2026-08-11T13:00:00Z"));
  assert.equal(proposal.materiality, "ordinary");
  assert.equal(result.canCommitAction, true);
  assert.equal(result.canExecute, false);
});

test("material actions fail closed without AOC policy evidence or approvals", () => {
  const proposal = createPMFreakMaterialActionProposal(base());
  const noPolicy = evaluatePMFreakMaterialActionGovernance(proposal, { evaluationId: "eval-1", evaluatedAt: "2026-08-11T12:01:00Z", evaluatorActorId: "server", state: "authorized", obligationReferenceIds: [], approvalReferenceIds: ["approval-1"], reasonCodes: [] }, new Date("2026-08-11T13:00:00Z"));
  assert.equal(noPolicy.state, "degraded");
  assert.equal(noPolicy.canCommitAction, false);
  const noApproval = evaluatePMFreakMaterialActionGovernance(proposal, { evaluationId: "eval-2", evaluatedAt: "2026-08-11T12:01:00Z", evaluatorActorId: "server", state: "authorized", policyDecisionReference: "policy-decision-1", obligationReferenceIds: [], approvalReferenceIds: [], reasonCodes: [] }, new Date("2026-08-11T13:00:00Z"));
  assert.equal(noApproval.state, "requires_approval");
  const noProvenance = createPMFreakMaterialActionProposal({ ...base(), evidenceReferenceIds: [] });
  const missingEvidence = evaluatePMFreakMaterialActionGovernance(noProvenance, { evaluationId: "eval-3", evaluatedAt: "2026-08-11T12:01:00Z", evaluatorActorId: "server", state: "authorized", policyDecisionReference: "policy-decision-1", obligationReferenceIds: [], approvalReferenceIds: ["approval-1"], reasonCodes: [] }, new Date("2026-08-11T13:00:00Z"));
  assert.equal(missingEvidence.state, "requires_review");
  assert.equal(missingEvidence.canCommitAction, false);
});

test("unknown, expired, stale, denied and revoked states never authorize", () => {
  const unknown = createPMFreakMaterialActionProposal({ ...base(), risk: "unknown" });
  const states = ["denied", "revoked", "unavailable", "degraded"] as const;
  for (const state of states) {
    const result = evaluatePMFreakMaterialActionGovernance(unknown, { evaluationId: `eval-${state}`, evaluatedAt: "2026-08-11T12:01:00Z", evaluatorActorId: "server", state, obligationReferenceIds: [], approvalReferenceIds: [], reasonCodes: [] }, new Date("2026-08-11T13:00:00Z"));
    assert.equal(result.canCommitAction, false);
  }
  const expired = evaluatePMFreakMaterialActionGovernance(createPMFreakMaterialActionProposal(base()), { evaluationId: "eval-expired", evaluatedAt: "2026-08-11T12:01:00Z", evaluatorActorId: "server", state: "authorized", policyDecisionReference: "policy-1", obligationReferenceIds: [], approvalReferenceIds: ["approval-1"], reasonCodes: [] }, new Date("2026-08-13T00:00:00Z"));
  assert.equal(expired.state, "expired");
});

test("malformed proposals are rejected before governance", () => {
  assert.throws(() => createPMFreakMaterialActionProposal({ ...base(), workspaceId: "" }), /workspaceId/);
  assert.throws(() => createPMFreakMaterialActionProposal({ ...base(), decisionReferenceId: "other" }), /decisionReferenceId/);
  assert.throws(() => createPMFreakMaterialActionProposal({ ...base(), expiresAt: base().createdAt }), /expiry/);
});
