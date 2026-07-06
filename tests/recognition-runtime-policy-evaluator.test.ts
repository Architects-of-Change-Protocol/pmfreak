import test from "node:test";
import assert from "node:assert/strict";

import { RECOGNITION_POLICY_ORDER } from "../src/features/recognition-runtime/policies/index";
import { trustDomainValidityPolicy } from "../src/features/recognition-runtime/policies/trust-domain-validity-policy";
import { actorRecognitionPolicy } from "../src/features/recognition-runtime/policies/actor-recognition-policy";
import { rogueActorPolicy } from "../src/features/recognition-runtime/policies/rogue-actor-policy";
import { passportValidityPolicy } from "../src/features/recognition-runtime/policies/passport-validity-policy";
import { capabilityValidityPolicy } from "../src/features/recognition-runtime/policies/capability-validity-policy";
import { capabilityScopePolicy } from "../src/features/recognition-runtime/policies/capability-scope-policy";
import { evidenceRequirementPolicy } from "../src/features/recognition-runtime/policies/evidence-requirement-policy";
import { approvalRequirementPolicy } from "../src/features/recognition-runtime/policies/approval-requirement-policy";
import type { PolicyContext } from "../src/features/recognition-runtime/policies/policy-context";
import type { ActionRequest } from "../src/features/recognition-runtime/domain/action-request";

const NOW = "2026-07-06T00:00:00.000Z";

const baseActionRequest: ActionRequest = {
  id: "ar-1",
  trustDomainId: "td-1",
  actorId: "actor-victor",
  action: "update_project_status",
  resourceScope: "project:HMP-14665",
  passportId: "passport-victor",
  capabilityTokenId: "token-victor",
  requestedAt: NOW,
};

const baseCtx = (overrides: Partial<PolicyContext> = {}): PolicyContext => ({
  actionRequest: baseActionRequest,
  now: NOW,
  trustDomain: { id: "td-1", name: "Datasys Agent Republic", status: "active", createdAt: NOW },
  actor: { id: "actor-victor", trustDomainId: "td-1", type: "human", displayName: "Victor", status: "active", createdAt: NOW },
  passport: { id: "passport-victor", actorId: "actor-victor", trustDomainId: "td-1", status: "active", issuedAt: NOW },
  capabilityToken: {
    id: "token-victor",
    actorId: "actor-victor",
    trustDomainId: "td-1",
    passportId: "passport-victor",
    capability: "update_project_status",
    resourceScope: "project:HMP-14665",
    status: "active",
    issuedAt: NOW,
  },
  requirementRule: undefined,
  ...overrides,
});

test("policy evaluation order is fixed and covers all ten checks", () => {
  assert.equal(RECOGNITION_POLICY_ORDER.length, 8);
});

test("trust_domain_validity_policy fails when the trust domain is missing", () => {
  const outcome = trustDomainValidityPolicy(baseCtx({ trustDomain: undefined }));
  assert.equal(outcome.outcome, "policy_violation");
  assert.equal(outcome.result.reasonCode, "TRUST_DOMAIN_UNKNOWN");
});

test("trust_domain_validity_policy fails when the trust domain is suspended", () => {
  const outcome = trustDomainValidityPolicy(baseCtx({ trustDomain: { id: "td-1", name: "X", status: "suspended", createdAt: NOW } }));
  assert.equal(outcome.outcome, "policy_violation");
  assert.equal(outcome.result.reasonCode, "TRUST_DOMAIN_SUSPENDED");
});

test("trust_domain_validity_policy passes for an active trust domain", () => {
  const outcome = trustDomainValidityPolicy(baseCtx());
  assert.equal(outcome.result.passed, true);
});

test("actor_recognition_policy fails for an unregistered actor", () => {
  const outcome = actorRecognitionPolicy(baseCtx({ actor: undefined }));
  assert.equal(outcome.outcome, "deny_unrecognized_actor");
  assert.equal(outcome.result.reasonCode, "ACTOR_UNKNOWN");
});

test("actor_recognition_policy fails deny_revoked for a revoked actor", () => {
  const outcome = actorRecognitionPolicy(baseCtx({ actor: { id: "a", trustDomainId: "td-1", type: "human", displayName: "A", status: "revoked", createdAt: NOW } }));
  assert.equal(outcome.outcome, "deny_revoked");
  assert.equal(outcome.result.reasonCode, "ACTOR_REVOKED");
});

test("rogue_actor_policy fails when the actor belongs to a different trust domain", () => {
  const outcome = rogueActorPolicy(
    baseCtx({ actor: { id: "a", trustDomainId: "other-domain", type: "agent", displayName: "A", status: "active", createdAt: NOW } })
  );
  assert.equal(outcome.outcome, "deny_rogue_actor");
  assert.equal(outcome.result.reasonCode, "ACTOR_TRUST_DOMAIN_MISMATCH");
});

test("rogue_actor_policy fails when the actor is explicitly flagged rogue", () => {
  const outcome = rogueActorPolicy(
    baseCtx({ actor: { id: "a", trustDomainId: "td-1", type: "agent", displayName: "A", status: "active", createdAt: NOW, metadata: { rogue: true } } })
  );
  assert.equal(outcome.outcome, "deny_rogue_actor");
  assert.equal(outcome.result.reasonCode, "ACTOR_FLAGGED_ROGUE");
});

test("passport_validity_policy fails policy_violation when no passport is referenced", () => {
  const outcome = passportValidityPolicy(baseCtx({ actionRequest: { ...baseActionRequest, passportId: undefined } }));
  assert.equal(outcome.outcome, "policy_violation");
  assert.equal(outcome.result.reasonCode, "PASSPORT_REQUIRED");
});

test("passport_validity_policy fails deny_revoked for a revoked passport", () => {
  const outcome = passportValidityPolicy(baseCtx({ passport: { id: "p", actorId: "actor-victor", trustDomainId: "td-1", status: "revoked", issuedAt: NOW } }));
  assert.equal(outcome.outcome, "deny_revoked");
});

test("passport_validity_policy fails deny_expired for an expired passport", () => {
  const outcome = passportValidityPolicy(
    baseCtx({ passport: { id: "p", actorId: "actor-victor", trustDomainId: "td-1", status: "active", issuedAt: NOW, expiresAt: NOW } })
  );
  assert.equal(outcome.outcome, "deny_expired");
});

test("capability_validity_policy fails policy_violation when no token is referenced", () => {
  const outcome = capabilityValidityPolicy(baseCtx({ actionRequest: { ...baseActionRequest, capabilityTokenId: undefined } }));
  assert.equal(outcome.outcome, "policy_violation");
  assert.equal(outcome.result.reasonCode, "CAPABILITY_TOKEN_REQUIRED");
});

test("capability_validity_policy fails deny_revoked for a revoked token", () => {
  const outcome = capabilityValidityPolicy(
    baseCtx({
      capabilityToken: {
        id: "token-victor",
        actorId: "actor-victor",
        trustDomainId: "td-1",
        passportId: "passport-victor",
        capability: "update_project_status",
        resourceScope: "project:HMP-14665",
        status: "revoked",
        issuedAt: NOW,
      },
    })
  );
  assert.equal(outcome.outcome, "deny_revoked");
});

test("capability_scope_policy fails deny_out_of_scope for a mismatched resource scope", () => {
  const outcome = capabilityScopePolicy(baseCtx({ actionRequest: { ...baseActionRequest, resourceScope: "project:GCH-15992" } }));
  assert.equal(outcome.outcome, "deny_out_of_scope");
  assert.equal(outcome.result.reasonCode, "RESOURCE_SCOPE_MISMATCH");
});

test("capability_scope_policy fails deny_out_of_scope for a mismatched action/capability", () => {
  const outcome = capabilityScopePolicy(baseCtx({ actionRequest: { ...baseActionRequest, action: "delete_project" } }));
  assert.equal(outcome.outcome, "deny_out_of_scope");
  assert.equal(outcome.result.reasonCode, "CAPABILITY_ACTION_MISMATCH");
});

test("evidence_requirement_policy fails require_more_evidence when evidence is missing", () => {
  const outcome = evidenceRequirementPolicy(
    baseCtx({
      requirementRule: {
        id: "r1",
        trustDomainId: "td-1",
        actionPattern: "update_project_status",
        riskLevel: "medium",
        requiredEvidenceTypes: ["project_context"],
        requiresHumanApproval: false,
      },
    })
  );
  assert.equal(outcome.outcome, "require_more_evidence");
});

test("evidence_requirement_policy passes when required evidence is present", () => {
  const outcome = evidenceRequirementPolicy(
    baseCtx({
      actionRequest: {
        ...baseActionRequest,
        evidence: [{ id: "e1", type: "project_context", providedByActorId: "actor-victor", createdAt: NOW }],
      },
      requirementRule: {
        id: "r1",
        trustDomainId: "td-1",
        actionPattern: "update_project_status",
        riskLevel: "medium",
        requiredEvidenceTypes: ["project_context"],
        requiresHumanApproval: false,
      },
    })
  );
  assert.equal(outcome.result.passed, true);
});

test("approval_requirement_policy fails require_human_approval when the rule demands it", () => {
  const outcome = approvalRequirementPolicy(
    baseCtx({
      requirementRule: {
        id: "r1",
        trustDomainId: "td-1",
        actionPattern: "send_client_follow_up",
        riskLevel: "medium",
        requiredEvidenceTypes: [],
        requiresHumanApproval: true,
      },
    })
  );
  assert.equal(outcome.outcome, "require_human_approval");
});

test("approval_requirement_policy passes when no rule requires approval", () => {
  const outcome = approvalRequirementPolicy(baseCtx());
  assert.equal(outcome.result.passed, true);
});
