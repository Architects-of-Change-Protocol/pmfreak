/**
 * P2-13 — deterministic Founder scenario manifest.
 *
 * PURE MODULE. No I/O, no network, no environment reads, no clock reads.
 * Everything here is derivable from constants so that `seed`, `verify`,
 * `reset` and `reseed` all address exactly the same scenario, and so the
 * P2-14 handoff can be generated without touching a database.
 *
 * Identity rules (P2-13 §5):
 *   - Identity is a deterministic id or a deterministic natural key.
 *   - Never a title, never a timestamp proximity, never insertion order.
 *
 * Canonical ids that the verified P2-03/P2-04/P2-06/P2-07/P2-08/P2-09
 * contracts generate themselves (Source, Raw Input, Normalized Event,
 * Evidence, Signal, Risk/Issue, Governance Event, Recommendation, ...) are
 * NOT forced to a deterministic value here. They are addressed by the
 * deterministic natural key the contract itself accepts — `source_key`,
 * `idempotency_key`, `correlation_id` — because forcing their primary keys
 * would mean bypassing the derivation boundary this prompt exists to honour.
 */

import { createHash } from "node:crypto";

export const P2_13_NAMESPACE = "pmfreak:p2-13:founder-invite:v1";
export const P2_13_SCENARIO_KEY = "p2_13_founder_invite_v1";

/** The canonical fixture label already enforced by the verified schema. */
export const FIXTURE_LABEL = "DEMO / FIXTURE";

/** Canonical evidence fixture classification produced by P2-04 derivation. */
export const FIXTURE_EVIDENCE_STATE = "DEMO_FIXTURE";

/** Which prompt owns removal of these fixtures (D7 / P2-13 §29). */
export const FIXTURE_EXPIRY_OWNER = "P2-14";

/**
 * Fixed intake instants.
 *
 * Deterministic on purpose: `verify` asserts exact equality, and a wall-clock
 * read would make "same scenario" unprovable across a reseed. Digests do not
 * depend on these values (only on {title, content}), so a reseed reproduces
 * byte-identical content and event digests either way — but pinning them also
 * removes insertion time as an accidental identity signal.
 */
export const FIXTURE_OCCURRED_AT = "2026-02-03T09:15:00.000Z";
export const FIXTURE_EVALUATED_AT = "2026-02-03T09:20:00.000Z";

/** Deterministic RFC-4122 v5-shaped id derived from the P2-13 namespace. */
export function deterministicUuid(...parts) {
  const hex = createHash("sha256")
    .update([P2_13_NAMESPACE, ...parts].join("|"), "utf8")
    .digest("hex");
  const variant = ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export const P2_13_SCENARIO_ID = deterministicUuid("scenario");

/** Short, stable, log-safe scenario discriminator used inside natural keys. */
const SCENARIO_TAG = P2_13_SCENARIO_ID.slice(0, 8);

/**
 * Actor roles seeded per tenant.
 *
 * `write` actors exercise the real authenticated canonical path. `viewer`
 * exists so P2-14 (and this harness) can prove a role negative without
 * inventing one later.
 */
const TENANT_DEFINITIONS = [
  {
    key: "A",
    semanticRole: "founder_scenario_under_test",
    displayName: "DEMO / FIXTURE P2-13 Founder Tenant A",
    projectName: "DEMO / FIXTURE P2-13 Founder Project A",
    actors: [
      { key: "owner", role: "owner", purpose: "primary Founder actor" },
      { key: "pm", role: "pm", purpose: "same-tenant positive write actor" },
      { key: "viewer", role: "viewer", purpose: "same-tenant role negative" },
    ],
    intake: {
      title: "DEMO / FIXTURE Founder scope request",
      content:
        "The client requested an additional activity outside the agreed scope and asked the team to start without formal approval.",
      assertionType: "FACT",
      classification: "DECISION_CONTEXT",
      confidenceScore: 0.95,
      missingDataState: "COMPLETE",
    },
  },
  {
    key: "B",
    semanticRole: "isolation_negative_control",
    displayName: "DEMO / FIXTURE P2-13 Isolation Tenant B",
    projectName: "DEMO / FIXTURE P2-13 Isolation Project B",
    actors: [
      { key: "owner", role: "owner", purpose: "cross-tenant negative-control actor" },
    ],
    intake: {
      title: "DEMO / FIXTURE isolation control scope request",
      // Deliberately phrased to match exactly the same two deterministic
      // detector rules as Tenant A (`additional activity` -> scope_creep,
      // `without formal approval` -> missing_approval) so both tenants seed
      // an identical canonical shape and the isolation negatives compare
      // like with like. Any other wording would make the expected chain
      // counts a guess rather than a contract-derived constant.
      content:
        "The client asked for an additional activity beyond the agreed scope and the team started without formal approval.",
      assertionType: "FACT",
      classification: "DECISION_CONTEXT",
      confidenceScore: 0.9,
      missingDataState: "COMPLETE",
    },
  },
];

/**
 * Canonical spine ownership.
 *
 * P2-13 prepares state; P2-14 must still OBSERVE and PERFORM the transitions
 * its acceptance story verifies (P2-13 §8, §30). Pre-completing the Decision
 * onward would make the P2-14 story pass without exercising it.
 */
export const CANONICAL_SPINE_OWNERSHIP = Object.freeze({
  source: "PRESEEDED",
  rawInput: "PRESEEDED",
  normalizedEvent: "PRESEEDED",
  evidence: "PRESEEDED",
  finding: "PRESEEDED",
  recommendation: "PRESEEDED",
  decision: "P2-14 CREATED",
  materialAction: "P2-14 CREATED",
  task: "P2-14 CREATED",
  internalExecution: "P2-14 CREATED",
  outcome: "P2-14 CREATED",
  observation: "P2-14 CREATED",
});

/**
 * `finding` is the canonical Signal -> Risk/Issue -> Governance Event fan-out
 * that `materialize_operational_chain` produces from one Evidence item. The
 * verified detector emits exactly two branches for this fixture content
 * (scope_creep + missing_approval), so these counts are contract-derived,
 * not guessed. `verify` asserts them exactly.
 */
export const EXPECTED_CHAIN_COUNTS = Object.freeze({
  signals: 2,
  riskIssueRecords: 2,
  governanceEvents: 2,
  recommendations: 2,
});

function buildTenant(definition) {
  const workspaceId = deterministicUuid("tenant", definition.key, "workspace");
  const projectId = deterministicUuid("tenant", definition.key, "project");

  return Object.freeze({
    key: definition.key,
    semanticRole: definition.semanticRole,
    workspaceId,
    projectId,
    workspaceName: definition.displayName,
    projectName: definition.projectName,
    fixtureLabel: FIXTURE_LABEL,

    actors: Object.freeze(
      definition.actors.map((actor) =>
        Object.freeze({
          key: actor.key,
          role: actor.role,
          purpose: actor.purpose,
          // Deterministic natural key. The auth user id is assigned by GoTrue
          // and resolved by this email, never invented here.
          email: `p2-13-${SCENARIO_TAG}-${definition.key.toLowerCase()}-${actor.key}@example.test`,
          reference: `p2-13:tenant-${definition.key}:${actor.key}`,
        }),
      ),
    ),

    /** Founder Invite access preconditions (P2-13 §10). */
    founderInvite: Object.freeze({
      inviteEmail: `p2-13-${SCENARIO_TAG}-${definition.key.toLowerCase()}-owner@example.test`,
      inviteId: deterministicUuid("tenant", definition.key, "early-access-invite"),
      trialLicenseId: deterministicUuid("tenant", definition.key, "trial-license"),
      workspaceActivationId: deterministicUuid("tenant", definition.key, "workspace-activation"),
      inviteNote: `${FIXTURE_LABEL} P2-13 Founder Invite seed (expires when ${FIXTURE_EXPIRY_OWNER} is VERIFIED).`,
    }),

    /** Canonical intake natural keys (P2-03 / P2-04 contracts). */
    intake: Object.freeze({
      sourceKey: `p2-13-founder-fixture-${definition.key.toLowerCase()}:v1`,
      rawIdempotencyKey: `p2-13-${SCENARIO_TAG}-${definition.key.toLowerCase()}-raw-v1`,
      evidenceIdempotencyKey: `p2-13-${SCENARIO_TAG}-${definition.key.toLowerCase()}-evidence-v1`,
      correlationId: deterministicUuid("tenant", definition.key, "intake-correlation"),
      externalId: `p2-13-${SCENARIO_TAG}-${definition.key.toLowerCase()}-external-v1`,
      occurredAt: FIXTURE_OCCURRED_AT,
      evaluatedAt: FIXTURE_EVALUATED_AT,
      title: definition.intake.title,
      content: definition.intake.content,
      assertionType: definition.intake.assertionType,
      classification: definition.intake.classification,
      confidenceScore: definition.intake.confidenceScore,
      missingDataState: definition.intake.missingDataState,
      // No `staleAt`: P2-04 derives FRESHNESS = CURRENT when stale_at is null,
      // so the fixture stays deterministically CURRENT without the harness
      // asserting a freshness state the contract did not compute.
      staleAt: null,
    }),
  });
}

export const P2_13_TENANTS = Object.freeze(TENANT_DEFINITIONS.map(buildTenant));

export const TENANT_A = P2_13_TENANTS[0];
export const TENANT_B = P2_13_TENANTS[1];

export function tenantByKey(key) {
  const tenant = P2_13_TENANTS.find((candidate) => candidate.key === key);
  if (!tenant) throw new Error(`p2_13_unknown_tenant:${key}`);
  return tenant;
}

export function actorFor(tenantKey, actorKey) {
  const tenant = tenantByKey(tenantKey);
  const actor = tenant.actors.find((candidate) => candidate.key === actorKey);
  if (!actor) throw new Error(`p2_13_unknown_actor:${tenantKey}:${actorKey}`);
  return actor;
}

/** Every deterministic workspace id this scenario owns. */
export const SCENARIO_WORKSPACE_IDS = Object.freeze(P2_13_TENANTS.map((t) => t.workspaceId));

/** Every deterministic project id this scenario owns. */
export const SCENARIO_PROJECT_IDS = Object.freeze(P2_13_TENANTS.map((t) => t.projectId));

/** Every deterministic fixture actor email this scenario owns. */
export const SCENARIO_ACTOR_EMAILS = Object.freeze(
  P2_13_TENANTS.flatMap((tenant) => tenant.actors.map((actor) => actor.email)),
);

/**
 * The structured P2-14 handoff (P2-13 §20). Contains no credential of any
 * kind: actor identity is carried as a deterministic email natural key and a
 * stable reference, never as a password, token or session.
 */
export function buildP2_14HandoffManifest() {
  return {
    contract: "pmfreak.p2-13.founder-scenario-handoff.v1",
    founderScenarioId: P2_13_SCENARIO_ID,
    scenarioKey: P2_13_SCENARIO_KEY,
    fixtureLabel: FIXTURE_LABEL,
    fixtureEvidenceState: FIXTURE_EVIDENCE_STATE,
    fixtureExpiryOwner: FIXTURE_EXPIRY_OWNER,
    tenants: P2_13_TENANTS.map((tenant) => ({
      key: tenant.key,
      semanticRole: tenant.semanticRole,
      workspaceId: tenant.workspaceId,
      projectId: tenant.projectId,
      actors: tenant.actors.map((actor) => ({
        reference: actor.reference,
        email: actor.email,
        role: actor.role,
        purpose: actor.purpose,
      })),
      commandCenterPath: `/command-center?projectId=${tenant.projectId}`,
    })),
    seededStartState: {
      source: "DEMO / FIXTURE operational source, is_fixture = true",
      rawInput: "one immutable raw input carrying a real sha256 content digest",
      normalizedEvent: "one accepted normalized event referencing that raw input",
      evidence: "one derived evidence item, fixture_state = DEMO_FIXTURE",
      finding: `${EXPECTED_CHAIN_COUNTS.signals} signals, ${EXPECTED_CHAIN_COUNTS.riskIssueRecords} risk/issue records, ${EXPECTED_CHAIN_COUNTS.governanceEvents} governance events`,
      recommendation: `${EXPECTED_CHAIN_COUNTS.recommendations} governed recommendations in status "proposed"`,
      founderAccess:
        "accepted early-access invite + active trial license + workspace activation per tenant",
    },
    expectedP2_14Transitions: [
      "record a separate human Decision on a proposed governed Recommendation",
      "propose a separate governed Material Action from that Decision",
      "dispatch the authorized Material Action to exactly one internal Task",
      "drive internal Task execution through its lifecycle",
      "ensure an expected Outcome that Task completion does not achieve",
      "record an evidence-linked Outcome Observation",
      "review complete lineage and the canonical audit export",
    ],
    expectedNegativeControl: {
      tenant: TENANT_B.key,
      workspaceId: TENANT_B.workspaceId,
      projectId: TENANT_B.projectId,
      expectations: [
        "Tenant A actors must not read Tenant B lineage",
        "Tenant A actors must not mutate Tenant B state",
        "Tenant B actors must not read Tenant A lineage",
        "cross-project and cross-workspace id substitution must be denied server-side",
      ],
    },
    canonicalSpineOwnership: CANONICAL_SPINE_OWNERSHIP,
    commands: {
      preflight: "npm run seed:p2-13-founder -- preflight",
      seed: "npm run seed:p2-13-founder -- seed",
      verify: "npm run seed:p2-13-founder -- verify",
      reset: "npm run seed:p2-13-founder -- reset",
      reseed: "npm run seed:p2-13-founder -- reseed",
      runtimeAcceptance: "npm run check:p2-13-db",
    },
  };
}
