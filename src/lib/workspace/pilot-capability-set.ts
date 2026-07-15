/**
 * Pilot Gate Sprint 01 — Task 7 (pilot capability set).
 *
 * Written capability-set decision for the closed free pilot (see
 * docs/release/pilot-capability-set.md for the rationale and the full
 * per-audience matrix):
 *
 *   - Founder / internal users  → "founder" profile: everything visible.
 *   - Design partners / closed-pilot accounts → "pilot" profile: the
 *     incomplete-governance, AOC-trust, and dead/experimental surfaces are
 *     HIDDEN from navigation (not deleted — code and routes remain, and
 *     the plan gates + M-03 governance switch keep them non-functional for
 *     pilot accounts even by direct URL).
 *
 * Deployment override: PMFREAK_CAPABILITY_PROFILE=founder forces the
 * founder profile for every user (single-operator internal deployments).
 * The safe default is "pilot".
 */

export type CapabilityProfile = "founder" | "pilot";

/**
 * Navigation hrefs hidden from pilot participants:
 *  - /governance, /policies, /audit — governance surface: real code but
 *    pilot-incomplete; claim signing disabled by default (M-03).
 *  - /trust/agents, /capabilities — AOC trust/attestation surfaces: not
 *    externally assured; must not be presented to partners as product.
 *  - /trials — founder/internal early-access tooling.
 *  - /intelligence — dead nav node (redirects to /command-center).
 */
export const PILOT_HIDDEN_HREFS: readonly string[] = [
  "/governance",
  "/policies",
  "/audit",
  "/trust/agents",
  "/capabilities",
  "/trials",
  "/intelligence",
];

export function isHiddenForProfile(href: string, profile: CapabilityProfile): boolean {
  if (profile === "founder") return false;
  return PILOT_HIDDEN_HREFS.includes(href);
}

/**
 * Server-side profile resolution. `isFounderOrInternal` comes from
 * `isFounderOrInternalUser` (src/lib/auth.ts); the env override applies to
 * whole deployments (internal/demo environments).
 */
export function resolveCapabilityProfile(input: {
  isFounderOrInternal: boolean;
  env?: NodeJS.ProcessEnv;
}): CapabilityProfile {
  const env = input.env ?? process.env;
  if (env.PMFREAK_CAPABILITY_PROFILE === "founder") return "founder";
  return input.isFounderOrInternal ? "founder" : "pilot";
}
