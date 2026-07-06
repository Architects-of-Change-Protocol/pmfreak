// Denial scenarios built on the Datasys fixture: unrecognized actors,
// rogue actors, revoked/expired credentials, and out-of-scope capability
// use. Each helper returns a ready-to-verify ActionRequest.

import type { ActionRequest } from "../domain";
import { buildActionRequest, UNKNOWN_EXTERNAL_AGENT_ID, type DatasysFixture } from "./datasys.fixture";

// Actor was never registered in this trust domain at all.
export function unknownExternalAgentRequest(fixture: DatasysFixture): ActionRequest {
  return buildActionRequest(fixture, {
    id: "action-request-unknown-external-agent",
    actorId: UNKNOWN_EXTERNAL_AGENT_ID,
    action: "send_client_follow_up",
    resourceScope: "project:HMP-14665",
  });
}

// Victor holds a capability token, but scoped to a different project.
export function victorOutOfScopeRequest(fixture: DatasysFixture): ActionRequest {
  return buildActionRequest(fixture, {
    id: "action-request-victor-out-of-scope",
    actorId: fixture.victor.id,
    action: "update_project_status",
    resourceScope: "project:GCH-15992",
    passportId: fixture.victorPassport.id,
    capabilityTokenId: fixture.victorProjectToken.id,
  });
}
