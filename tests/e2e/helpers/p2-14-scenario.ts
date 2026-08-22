/**
 * P2-14 — the deterministic scenario under test, read from P2-13's own handoff.
 *
 * Identities are NOT reconstructed here. `buildP2_14HandoffManifest()` is the machine-
 * readable contract P2-13 publishes for exactly this purpose, so a change to the scenario
 * reaches this suite through the manifest instead of through two drifting copies.
 */

// Pure .mjs manifest module — intentionally untyped and dependency-free. `allowJs` lets
// TypeScript infer it, so no suppression is needed.
import { buildP2_14HandoffManifest } from "../../../scripts/p2-13/founder-scenario-manifest.mjs";

type ManifestActor = { reference: string; email: string; role: string; purpose: string };
type ManifestTenant = {
  key: string;
  semanticRole: string;
  workspaceId: string;
  projectId: string;
  actors: ManifestActor[];
  commandCenterPath: string;
};
type Manifest = {
  contract: string;
  founderScenarioId: string;
  fixtureLabel: string;
  fixtureEvidenceState: string;
  tenants: ManifestTenant[];
};

export const MANIFEST = buildP2_14HandoffManifest() as Manifest;

function tenant(key: string): ManifestTenant {
  const found = MANIFEST.tenants.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`p2_14_manifest_tenant_missing:${key}`);
  return found;
}

export const TENANT_A = tenant("A");
export const TENANT_B = tenant("B");

export function actor(t: ManifestTenant, key: string): ManifestActor {
  const found = t.actors.find((candidate) => candidate.reference.endsWith(`:${key}`));
  if (!found) throw new Error(`p2_14_manifest_actor_missing:${t.key}:${key}`);
  return found;
}

/**
 * The fixture password, from the environment only.
 *
 * Never defaulted, never logged, never written to an artifact. A missing value is a hard
 * failure rather than a silent fallback, because a fallback would make "authentication
 * passed" mean something other than what it claims.
 */
export function fixturePassword(): string {
  const value = process.env.P2_13_FIXTURE_ACTOR_PASSWORD;
  if (!value || value.length < 12) {
    throw new Error("P2_13_FIXTURE_ACTOR_PASSWORD is missing or too short; P2-14 cannot authenticate real fixture actors.");
  }
  return value;
}

/** P2-13's fixture source key for a tenant — used to prove LIVE intake refuses it. */
export function fixtureSourceKey(tenantKey: string): string {
  return `p2-13-founder-fixture-${tenantKey.toLowerCase()}:v1`;
}

/** Canonical nodes P2-14 owns. P2-13 asserts every one of these is zero before the story. */
export const P2_14_OWNED_NODES = [
  "decisions",
  "materialActions",
  "tasks",
  "executions",
  "outcomes",
  "observations",
] as const;
