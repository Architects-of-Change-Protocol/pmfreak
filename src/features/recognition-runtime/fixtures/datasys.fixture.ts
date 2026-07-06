// Datasys demo fixture — the scenario referenced throughout the AOC
// Recognition Runtime README and tests.
//
// Trust domain: Datasys Agent Republic
// Actors:
//  - Victor Valverde (human): can update project status on project:HMP-14665
//  - Finance Approver (human): can approve financial actions across finance:*
//  - PMFreak Closure Agent (agent): can send client follow-ups on project:HMP-14665,
//    but that action requires evidence + human approval
//  - "Unknown External Agent" is deliberately NOT registered here — tests
//    reference its id directly to exercise deny_unrecognized_actor.

import type { ActionRequest, Actor, Passport, RecognitionCapabilityToken, RecognitionRuntimeContext, TrustDomain } from "../domain";
import { createAocRecognitionRuntime, type AocRecognitionRuntime } from "../runtime";
import { createDeterministicContext } from "./deterministic-context";

export const UNKNOWN_EXTERNAL_AGENT_ID = "actor-unknown-external-agent";

export type DatasysFixture = {
  context: RecognitionRuntimeContext;
  runtime: AocRecognitionRuntime;
  trustDomain: TrustDomain;
  victor: Actor;
  financeApprover: Actor;
  pmfreakAgent: Actor;
  victorPassport: Passport;
  financePassport: Passport;
  pmfreakPassport: Passport;
  victorProjectToken: RecognitionCapabilityToken;
  financeApprovalToken: RecognitionCapabilityToken;
  pmfreakFollowUpToken: RecognitionCapabilityToken;
};

export function buildDatasysFixture(): DatasysFixture {
  const context = createDeterministicContext();
  const runtime = createAocRecognitionRuntime(context);

  const trustDomain = runtime.createTrustDomain({
    id: "trust-domain-datasys",
    name: "Datasys Agent Republic",
  });

  const victor = runtime.registerActor({
    id: "actor-victor",
    trustDomainId: trustDomain.id,
    type: "human",
    displayName: "Victor Valverde",
  });

  const financeApprover = runtime.registerActor({
    id: "actor-finance-approver",
    trustDomainId: trustDomain.id,
    type: "human",
    displayName: "Finance Approver",
  });

  const pmfreakAgent = runtime.registerActor({
    id: "actor-pmfreak-closure-agent",
    trustDomainId: trustDomain.id,
    type: "agent",
    displayName: "PMFreak Closure Agent",
  });

  const victorPassport = runtime.issuePassport({
    id: "passport-victor",
    actorId: victor.id,
    trustDomainId: trustDomain.id,
  });

  const financePassport = runtime.issuePassport({
    id: "passport-finance-approver",
    actorId: financeApprover.id,
    trustDomainId: trustDomain.id,
  });

  const pmfreakPassport = runtime.issuePassport({
    id: "passport-pmfreak-closure-agent",
    actorId: pmfreakAgent.id,
    trustDomainId: trustDomain.id,
  });

  const victorProjectToken = runtime.issueCapabilityToken({
    id: "token-victor-project",
    actorId: victor.id,
    trustDomainId: trustDomain.id,
    passportId: victorPassport.id,
    capability: "update_project_status",
    resourceScope: "project:HMP-14665",
  });

  const financeApprovalToken = runtime.issueCapabilityToken({
    id: "token-finance-approval",
    actorId: financeApprover.id,
    trustDomainId: trustDomain.id,
    passportId: financePassport.id,
    capability: "approve_financial_action",
    resourceScope: "finance:*",
  });

  const pmfreakFollowUpToken = runtime.issueCapabilityToken({
    id: "token-pmfreak-follow-up",
    actorId: pmfreakAgent.id,
    trustDomainId: trustDomain.id,
    passportId: pmfreakPassport.id,
    capability: "send_client_follow_up",
    resourceScope: "project:HMP-14665",
  });

  runtime.registerRequirementRule({
    id: "rule-send-client-follow-up",
    trustDomainId: trustDomain.id,
    actionPattern: "send_client_follow_up",
    resourceScopePattern: "project:*",
    riskLevel: "medium",
    requiredEvidenceTypes: ["project_context", "draft_action"],
    requiresHumanApproval: true,
  });

  return {
    context,
    runtime,
    trustDomain,
    victor,
    financeApprover,
    pmfreakAgent,
    victorPassport,
    financePassport,
    pmfreakPassport,
    victorProjectToken,
    financeApprovalToken,
    pmfreakFollowUpToken,
  };
}

export type BuildActionRequestInput = {
  id?: string;
  actorId: string;
  action: string;
  resourceScope: string;
  passportId?: string;
  capabilityTokenId?: string;
  evidence?: ActionRequest["evidence"];
  metadata?: Record<string, unknown>;
};

export function buildActionRequest(fixture: DatasysFixture, input: BuildActionRequestInput): ActionRequest {
  return {
    id: input.id ?? fixture.context.ids.nextId("action-request"),
    trustDomainId: fixture.trustDomain.id,
    actorId: input.actorId,
    action: input.action,
    resourceScope: input.resourceScope,
    passportId: input.passportId,
    capabilityTokenId: input.capabilityTokenId,
    evidence: input.evidence,
    requestedAt: fixture.context.clock.now(),
    metadata: input.metadata,
  };
}
