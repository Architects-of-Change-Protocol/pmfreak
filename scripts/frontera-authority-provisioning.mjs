/**
 * OPERATOR-SIDE Frontera authority provisioning.
 *
 * THIS IS NOT PRODUCT CODE. It holds the privileged operator context
 * (`system: true`) that Frontera requires for every write, and it must never
 * be imported from `src/**`. `scripts/check-frontera-product-consumer.mjs`
 * enforces that with a negative control.
 *
 * It represents an *enterprise operator* provisioning authority out of band —
 * a deployment bootstrap or admin CLI. It is emphatically not PMFreak
 * authorizing itself: nothing here runs because an application request
 * arrived, and no product path can reach it.
 */
import {
  createSqliteKernelAuthorityStore,
  createInMemoryKernelAuthorityStore,
  createKernelAuthorityProvisioningService,
} from "@aoc-enterprise/runtime/enterprise";

export const PMFREAK_EXTERNAL_SUBJECT_SYSTEM = "pmfreak";
export const FRONTERA_DISPATCH_ACTION = "execute.material-action";

export const projectScope = (projectId) => `project:${projectId}`;

/** Deterministic ids, so a re-run replays instead of conflicting. */
const ids = (organizationId) => ({
  orgActor: `actor-org-${organizationId}`,
  trustDomain: `trust-domain-${organizationId}`,
});

export async function openOperatorStore(dbPath) {
  return dbPath ? createSqliteKernelAuthorityStore(dbPath) : createInMemoryKernelAuthorityStore();
}

/**
 * Provisions the minimum authority for ONE PMFreak principal to dispatch
 * governed Material Actions in ONE project of ONE workspace.
 *
 * Minimum is meant literally: the capability token and authority grant name
 * exactly one action and exactly one project scope. There is no wildcard.
 */
export async function provisionPmfreakDispatchAuthority(store, input) {
  const { organizationId, principalUserId, projectId, operatorActorId = "operator-pmfreak-bootstrap" } = input;
  const OPERATOR = { system: true, actorId: operatorActorId };
  const operator = createKernelAuthorityProvisioningService({ store, organizationId });
  const { orgActor, trustDomain } = ids(organizationId);
  const actorId = `actor-${organizationId}-${principalUserId}`;

  await operator.provisionActor(OPERATOR, {
    actorId: orgActor,
    type: "organization",
    displayName: `PMFreak workspace ${organizationId}`,
  });
  await operator.provisionTrustDomain(OPERATOR, {
    trustDomainId: trustDomain,
    name: `PMFreak workspace ${organizationId}`,
    issuerActorId: orgActor,
    acceptedIssuerIds: [orgActor],
    acceptedActorTypes: ["human", "organization"],
  });
  await operator.provisionRootIssuer(OPERATOR, { trustDomainId: trustDomain, actorId: orgActor });
  await operator.provisionActor(OPERATOR, {
    actorId,
    type: "human",
    displayName: `PMFreak principal ${principalUserId}`,
    issuerId: orgActor,
    trustDomainId: trustDomain,
    // The explicit external-principal binding. PMFreak keeps no mapping table
    // of its own; Frontera owns this.
    externalSubject: { system: PMFREAK_EXTERNAL_SUBJECT_SYSTEM, subjectId: principalUserId },
  });
  await operator.provisionPassport(OPERATOR, {
    passportId: `passport-${organizationId}-${principalUserId}`,
    type: "identity",
    subjectActorId: actorId,
    issuerActorId: orgActor,
    trustDomainId: trustDomain,
  });
  await operator.provisionAuthorityGrant(OPERATOR, {
    authorityGrantId: `grant-${organizationId}-${principalUserId}-${projectId}`,
    issuerActorId: orgActor,
    subjectActorId: actorId,
    trustDomainId: trustDomain,
    capability: "material-action.dispatch",
    actions: [FRONTERA_DISPATCH_ACTION],
    resourceScopes: [projectScope(projectId)],
  });
  await operator.provisionCapabilityToken(OPERATOR, {
    capabilityTokenId: `cap-${organizationId}-${principalUserId}-${projectId}`,
    subjectActorId: actorId,
    principalActorId: actorId,
    issuerActorId: orgActor,
    trustDomainId: trustDomain,
    capability: "material-action.dispatch",
    actions: [FRONTERA_DISPATCH_ACTION],
    resourceScopes: [projectScope(projectId)],
    riskLevel: "medium",
  });

  return { operator, OPERATOR, actorId, trustDomainId: trustDomain, orgActorId: orgActor };
}

export async function revokePmfreakDispatchAuthority(store, input) {
  const { organizationId, principalUserId, projectId, reason = "operator revocation", operatorActorId = "operator-pmfreak-bootstrap" } = input;
  const OPERATOR = { system: true, actorId: operatorActorId };
  const operator = createKernelAuthorityProvisioningService({ store, organizationId });
  await operator.revoke(OPERATOR, {
    entityKind: "capability-token",
    entityId: `cap-${organizationId}-${principalUserId}-${projectId}`,
    reason,
  });
  await operator.revoke(OPERATOR, {
    entityKind: "authority-grant",
    entityId: `grant-${organizationId}-${principalUserId}-${projectId}`,
    reason,
  });
}
