// PMFreak Closure Agent demo scenario, built on top of the Datasys fixture.
//
// PMFreak Closure Agent wants to send_client_follow_up on project:HMP-14665:
//   1. No evidence attached          -> require_more_evidence
//   2. Evidence attached             -> require_human_approval (MVP has no
//      Approval Runtime yet, so this action can never reach "allow" on its
//      own — that is exactly the seam the next sprint plugs into)
//
// Also demonstrates Victor's ordinary, fully-satisfied action: allow.

import type { ActionRequest } from "../domain";
import { buildActionRequest, buildDatasysFixture, type DatasysFixture } from "./datasys.fixture";

export function pmfreakFollowUpWithoutEvidence(fixture: DatasysFixture): ActionRequest {
  return buildActionRequest(fixture, {
    id: "action-request-follow-up-no-evidence",
    actorId: fixture.pmfreakAgent.id,
    action: "send_client_follow_up",
    resourceScope: "project:HMP-14665",
    passportId: fixture.pmfreakPassport.id,
    capabilityTokenId: fixture.pmfreakFollowUpToken.id,
  });
}

export function pmfreakFollowUpWithEvidence(fixture: DatasysFixture): ActionRequest {
  return buildActionRequest(fixture, {
    id: "action-request-follow-up-with-evidence",
    actorId: fixture.pmfreakAgent.id,
    action: "send_client_follow_up",
    resourceScope: "project:HMP-14665",
    passportId: fixture.pmfreakPassport.id,
    capabilityTokenId: fixture.pmfreakFollowUpToken.id,
    evidence: [
      {
        id: "evidence-project-context",
        type: "project_context",
        providedByActorId: fixture.pmfreakAgent.id,
        description: "Project HMP-14665 status snapshot",
        createdAt: fixture.context.clock.now(),
      },
      {
        id: "evidence-draft-action",
        type: "draft_action",
        providedByActorId: fixture.pmfreakAgent.id,
        description: "Draft follow-up email to client",
        createdAt: fixture.context.clock.now(),
      },
    ],
  });
}

export function victorUpdateProjectStatus(fixture: DatasysFixture): ActionRequest {
  return buildActionRequest(fixture, {
    id: "action-request-victor-update-status",
    actorId: fixture.victor.id,
    action: "update_project_status",
    resourceScope: "project:HMP-14665",
    passportId: fixture.victorPassport.id,
    capabilityTokenId: fixture.victorProjectToken.id,
  });
}

export { buildDatasysFixture };
